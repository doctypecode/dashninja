import type {
  AggregateFn,
  ColumnSchema,
  Dashboard,
  DateGrain,
  DateRangePreset,
  NumberFormatKind,
  TransformStep,
  Widget,
  WidgetType,
} from "@/lib/model/types";
import { createWidget, WIDGET_DEFAULT_SIZE, WIDGET_LABELS, WIDGET_MIN_SIZE } from "@/lib/model/defaults";
import { addDataset, updateDataset, updateSteps } from "@/lib/builder/data-actions";
import { isDataBound } from "@/lib/builder/store";
import { getSourceTable } from "@/lib/connectors";
import { resolveDataset } from "@/lib/data/resolve";
import { runPipeline, type StepResult } from "@/lib/data/transform";
import { uid } from "@/lib/utils";
import { normalizeStep, type AiAction } from "./protocol";

/**
 * Turns the assistant's actions into a new dashboard draft, without touching
 * the live one. Every problem is reported; nothing is guessed or substituted.
 */

export interface DatasetSummary {
  kind: "dataset";
  label: string;
  steps: TransformStep[];
  results: StepResult[];
  rowsBefore: number;
  rowsAfter: number;
  columnsAdded: string[];
  columnsRemoved: string[];
  brokenWidgets: string[];
  errors: string[];
}

export interface WidgetSummary {
  kind: "widget";
  change: "add" | "update" | "remove";
  widgetType: WidgetType;
  title: string;
  detail: string;
  errors: string[];
}

export type ActionSummary = DatasetSummary | WidgetSummary;

export interface ActionPlan {
  next: Dashboard;
  items: ActionSummary[];
  errorCount: number;
  stats: { steps: number; datasets: number; widgets: number; updated: number; removed: number };
}

const WIDGET_TYPES = new Set<WidgetType>(["kpi", "line", "bar", "table", "text", "filter"]);
const AGGS = new Set<AggregateFn>(["sum", "avg", "count", "count_distinct", "min", "max"]);
const GRAINS = new Set<DateGrain>(["day", "week", "month", "quarter", "year"]);
const FORMATS = new Set<NumberFormatKind>(["number", "compact", "currency", "percent"]);
const RANGES = new Set<DateRangePreset>(["all", "last_3_months", "last_6_months", "last_12_months", "ytd"]);

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

function columnsOf(d: Dashboard, datasetId: string): ColumnSchema[] {
  const ds = d.datasets.find((x) => x.id === datasetId);
  return ds ? (resolveDataset(d, ds)?.table.columns ?? []) : [];
}

function widgetFields(w: Widget): string[] {
  if (!isDataBound(w)) return [];
  const b = w.binding;
  return [b.dimension, b.series, ...b.columns, ...b.measures.filter((m) => m.agg !== "count").map((m) => m.field)].filter((x): x is string => Boolean(x));
}

function findWidget(d: Dashboard, id: unknown): Widget | null {
  const key = str(id);
  if (!key) return null;
  return d.widgets.find((w) => w.id === key) ?? d.widgets.find((w) => w.title && w.title.toLowerCase() === key.toLowerCase()) ?? null;
}

/** The add_widget spec that describes an existing widget (format and style are kept as they are). */
export function specFromWidget(w: Widget): Record<string, unknown> {
  const base = { widget: w.type, title: w.title, description: w.description };
  if (isDataBound(w)) {
    const b = w.binding;
    return {
      ...base,
      dataset: b.datasetId,
      dimension: b.dimension,
      dateGrain: b.dateGrain,
      measures: b.measures,
      series: b.series,
      columns: b.columns,
      sort: b.sort,
      limit: b.limit,
      views: b.views ?? [],
      drill: b.drill ?? [],
      ...(w.type === "kpi" ? { dateField: w.options.dateField } : {}),
      ...(w.type === "bar" ? { orientation: w.options.orientation } : {}),
    };
  }
  if (w.type === "filter") return { ...base, dataset: w.options.datasetId, field: w.options.field, control: w.options.control, defaultRange: w.options.defaultRange };
  return { ...base, content: w.options.content, size: w.options.size };
}

export function planActions(input: Dashboard, actions: AiAction[]): ActionPlan {
  let d = input;
  const items: ActionSummary[] = [];
  const refs = new Map<string, string>(); // ref or name -> dataset id
  const newFilterIds: string[] = [];
  const stats = { steps: 0, datasets: 0, widgets: 0, updated: 0, removed: 0 };
  // New widgets flow in reading order below the existing ones. Filters, KPIs and
  // text each start their own row so the result reads like a dashboard.
  const flow = { x: 0, y: input.widgets.reduce((m, w) => Math.max(m, w.layout.y + w.layout.h), 0), rowH: 0, prev: null as WidgetType | null };
  const ROW_STARTERS: WidgetType[] = ["filter", "kpi", "text"];
  const place = (type: WidgetType, w: number, h: number) => {
    const breakRow = flow.prev !== null && flow.prev !== type && (ROW_STARTERS.includes(flow.prev) || ROW_STARTERS.includes(type));
    if (flow.x > 0 && (flow.x + w > 12 || breakRow)) {
      flow.y += flow.rowH;
      flow.x = 0;
      flow.rowH = 0;
    }
    const at = { x: flow.x, y: flow.y };
    flow.x += w;
    flow.rowH = Math.max(flow.rowH, h);
    flow.prev = type;
    return at;
  };

  const resolveDatasetRef = (ref: unknown): string | null => {
    const r = str(ref);
    if (!r) return d.datasets[0]?.id ?? null;
    if (refs.has(r)) return refs.get(r)!;
    if (d.datasets.some((x) => x.id === r)) return r;
    return d.datasets.find((x) => x.name.toLowerCase() === r.toLowerCase())?.id ?? null;
  };

  for (const action of actions) {
    if (action.type === "add_steps" || action.type === "new_dataset") {
      const targetId = resolveDatasetRef(action.type === "add_steps" ? action.datasetId : action.fromDatasetId);
      const target = d.datasets.find((x) => x.id === targetId) ?? null;
      const errors: string[] = [];
      const steps: TransformStep[] = [];
      for (const raw of action.steps ?? []) {
        const n = normalizeStep(raw, uid("st"));
        if ("error" in n) errors.push(n.error);
        else steps.push(n.step);
      }
      const name = action.type === "new_dataset" ? str(action.name) || `${target?.name ?? "Dataset"} (AI)` : "";
      const label = action.type === "add_steps" ? `Add ${steps.length} step${steps.length === 1 ? "" : "s"} to “${target?.name ?? "unknown dataset"}”` : `New dataset “${name}”`;
      const summary: DatasetSummary = { kind: "dataset", label, steps, results: [], rowsBefore: 0, rowsAfter: 0, columnsAdded: [], columnsRemoved: [], brokenWidgets: [], errors };
      items.push(summary);
      if (!target) {
        errors.push(`Dataset “${str(action.type === "add_steps" ? action.datasetId : action.fromDatasetId)}” doesn't exist.`);
        continue;
      }
      if (action.type === "new_dataset" && d.datasets.some((x) => x.name === name)) errors.push(`A dataset named “${name}” already exists.`);
      const source = d.sources.find((s) => s.id === target.sourceId);
      const table = source ? getSourceTable(d, source) : { columns: [], rows: [] };
      const before = runPipeline(table, target.steps);
      const after = runPipeline(table, [...target.steps, ...steps]);
      summary.results = after.steps.slice(target.steps.length);
      summary.results.forEach((r, i) => r.status === "error" && errors.push(`Step ${i + 1}: ${r.message}`));
      summary.rowsBefore = before.table.rows.length;
      summary.rowsAfter = after.table.rows.length;
      const b4 = new Set(before.table.columns.map((c) => c.name));
      const af = new Set(after.table.columns.map((c) => c.name));
      summary.columnsAdded = [...af].filter((c) => !b4.has(c));
      summary.columnsRemoved = [...b4].filter((c) => !af.has(c));
      if (action.type === "add_steps" && summary.columnsRemoved.length) {
        const removed = new Set(summary.columnsRemoved);
        summary.brokenWidgets = d.widgets.filter((w) => isDataBound(w) && w.binding.datasetId === target.id && widgetFields(w).some((f) => removed.has(f))).map((w) => w.title);
      }
      if (errors.length) continue;
      if (action.type === "add_steps") {
        d = updateSteps(d, target.id, (s) => [...s, ...steps]);
        stats.steps += steps.length;
      } else {
        const id = uid("ds");
        d = addDataset(d, target.sourceId, id, target).next;
        d = updateDataset(d, id, { name });
        d = updateSteps(d, id, (s) => [...s, ...steps]);
        refs.set(name, id);
        if (action.ref) refs.set(str(action.ref), id);
        stats.datasets += 1;
        stats.steps += steps.length;
      }
      continue;
    }

    if (action.type === "remove_widget") {
      const target = findWidget(d, (action as { id?: unknown }).id);
      const errors: string[] = [];
      items.push({ kind: "widget", change: "remove", widgetType: target?.type ?? "text", title: target?.title || (target ? WIDGET_LABELS[target.type] : str((action as { id?: unknown }).id)), detail: "", errors });
      if (!target) {
        errors.push("That widget isn't on the canvas.");
        continue;
      }
      d = {
        ...d,
        widgets: d.widgets
          .filter((w) => w.id !== target.id)
          .map((w) => (isDataBound(w) && w.binding.filterIds.includes(target.id) ? { ...w, binding: { ...w.binding, filterIds: w.binding.filterIds.filter((x) => x !== target.id) } } : w)),
      };
      stats.removed += 1;
      continue;
    }

    if (action.type === "add_widget" || action.type === "update_widget") {
      const isUpdate = action.type === "update_widget";
      const existing = isUpdate ? findWidget(d, (action as { id?: unknown }).id) : null;
      if (isUpdate && !existing) {
        items.push({ kind: "widget", change: "update", widgetType: "text", title: str((action as { id?: unknown }).id), detail: "", errors: ["That widget isn't on the canvas."] });
        continue;
      }
      // An update is the existing widget's spec with the requested fields replaced.
      const a = (existing ? { ...specFromWidget(existing), ...(action as Record<string, unknown>) } : action) as Record<string, unknown>;
      const type = str(a.widget) as WidgetType;
      const title = str(a.title);
      const errors: string[] = [];
      const summary: WidgetSummary = { kind: "widget", change: isUpdate ? "update" : "add", widgetType: WIDGET_TYPES.has(type) ? type : "text", title: title || WIDGET_LABELS[type] || "Widget", detail: "", errors };
      items.push(summary);
      if (!WIDGET_TYPES.has(type)) {
        errors.push(`Unknown widget type “${type}”.`);
        continue;
      }
      const datasetId = type === "text" ? null : resolveDatasetRef(a.dataset);
      if (type !== "text" && !datasetId) {
        errors.push(`Dataset “${str(a.dataset)}” doesn't exist.`);
        continue;
      }
      const cols = datasetId ? columnsOf(d, datasetId) : [];
      const has = (f: string) => cols.some((c) => c.name === f);
      const typeOf = (f: string) => cols.find((c) => c.name === f)?.type;
      const need = (f: string, role: string) => {
        if (f && !has(f)) errors.push(`${role} “${f}” isn't a column of this dataset.`);
      };

      const def = WIDGET_DEFAULT_SIZE[type];
      const min = WIDGET_MIN_SIZE[type];
      const w = Math.min(12, Math.max(min.w, Number(a.width) || def.w));
      const h = Math.max(min.h, Number(a.height) || def.h);
      // Keep the existing widget's style and options when its type doesn't change.
      const widget: Widget = existing && existing.type === type ? structuredClone(existing) : createWidget(type, { x: 0, y: 0 }, datasetId);
      if (existing && existing.type !== type && isDataBound(existing) && isDataBound(widget)) widget.binding = { ...widget.binding, filterIds: existing.binding.filterIds };
      if (title) widget.title = title;
      if (str(a.description)) widget.description = str(a.description);

      if (isDataBound(widget)) {
        const measures = (Array.isArray(a.measures) ? a.measures : []).map((m) => {
          const r = m as Record<string, unknown>;
          const agg = (AGGS.has(str(r.agg) as AggregateFn) ? str(r.agg) : "sum") as AggregateFn;
          const field = str(r.field);
          if (agg !== "count") need(field, "Measure");
          if (agg !== "count" && agg !== "count_distinct" && field && has(field) && typeOf(field) !== "number") errors.push(`Measure “${field}” isn't numeric, so ${agg.toUpperCase()} won't work.`);
          return { field, agg, ...(str(r.label) ? { label: str(r.label) } : {}) };
        });
        const dimension = str(a.dimension) || null;
        const series = str(a.series) || null;
        const columns = (Array.isArray(a.columns) ? a.columns : []).map(str).filter(Boolean);
        if (dimension) need(dimension, "Dimension");
        if (series) need(series, "Series");
        columns.forEach((c) => need(c, "Column"));
        if (widget.type === "kpi" && !measures.length) errors.push("A KPI needs one measure.");
        if ((widget.type === "line" || widget.type === "bar") && (!dimension || !measures.length)) errors.push("Charts need a dimension and at least one measure.");
        if (widget.type === "table" && !columns.length && !measures.length) errors.push("A table needs columns, or a dimension with measures.");
        const sort = a.sort as { by?: string; direction?: string } | undefined;
        const views = (Array.isArray(a.views) ? a.views : []).map(str).filter((v) => v && v !== dimension);
        const drill = (Array.isArray(a.drill) ? a.drill : []).map(str).filter((v) => v && v !== dimension);
        views.forEach((v) => need(v, "Toggle field"));
        drill.forEach((v) => need(v, "Drill field"));
        if ((views.length || drill.length) && widget.type !== "line" && widget.type !== "bar") errors.push("Toggles and drill-down are available on line and bar charts.");
        widget.binding = {
          ...widget.binding,
          views: views.length ? views : undefined,
          drill: drill.length ? drill : undefined,
          ...widget.binding,
          datasetId,
          dimension,
          dateGrain: GRAINS.has(str(a.dateGrain) as DateGrain) ? (str(a.dateGrain) as DateGrain) : "month",
          measures,
          series,
          columns,
          limit: Number(a.limit) > 0 ? Math.floor(Number(a.limit)) : null,
          sort: sort ? { by: sort.by === "measure" ? "measure" : "dimension", direction: sort.direction === "desc" ? "desc" : "asc" } : widget.binding.sort,
        };
        const fmt = str(a.format) as NumberFormatKind;
        if (FORMATS.has(fmt)) widget.format = { ...widget.format, kind: fmt, decimals: fmt === "percent" ? 1 : fmt === "compact" ? 1 : 0 };
        if (widget.type === "kpi") {
          const dateField = str(a.dateField) || cols.find((c) => c.type === "date")?.name || null;
          if (dateField) need(dateField, "Date field");
          widget.options = { ...widget.options, dateField, comparison: dateField ? "previous_period" : "none", showSparkline: Boolean(dateField) };
        }
        if ((widget.type === "line" || widget.type === "bar") && (series || measures.length > 1)) widget.options = { ...widget.options, showLegend: true };
        if (widget.type === "bar" && a.orientation === "horizontal") widget.options = { ...widget.options, orientation: "horizontal" };
        const ms = measures.map((m) => `${m.agg.toUpperCase()}(${m.agg === "count" ? "*" : m.field})`).join(", ");
        summary.detail = [
          ms,
          dimension ? `by ${dimension}${typeOf(dimension) === "date" ? ` (${widget.binding.dateGrain})` : ""}` : "",
          series ? `split by ${series}` : "",
          columns.length ? columns.join(", ") : "",
          views.length ? `· toggle ${[dimension, ...views].join(" / ")}` : "",
          drill.length ? `· drill ${[dimension, ...drill].join(" → ")}` : "",
        ]
          .filter(Boolean)
          .join(" ");
      } else if (widget.type === "filter") {
        const field = str(a.field);
        if (!field) errors.push("A filter needs a field.");
        else need(field, "Filter field");
        const control = a.control === "date_range" || typeOf(field) === "date" ? "date_range" : "select";
        const range = str(a.defaultRange) as DateRangePreset;
        widget.options = { ...widget.options, datasetId, field: field || null, control, defaultRange: RANGES.has(range) ? range : "all" };
        if (!title) widget.title = field ? field.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Filter";
        summary.detail = `${control === "date_range" ? "Date range" : "Pick values"} on ${field}`;
      } else if (widget.type === "text") {
        widget.options = { ...widget.options, content: str(a.content) || title || "Note", size: (["sm", "md", "lg", "xl"].includes(str(a.size)) ? str(a.size) : "lg") as "sm" | "md" | "lg" | "xl" };
        widget.title = "";
        summary.detail = widget.options.content.slice(0, 60);
      }
      summary.title = widget.title || WIDGET_LABELS[type];
      if (errors.length) continue;
      if (existing) {
        widget.id = existing.id;
        const rw = (action as { width?: unknown }).width ? w : existing.layout.w;
        const rh = (action as { height?: unknown }).height ? h : existing.layout.h;
        widget.layout = { ...existing.layout, w: Math.max(min.w, rw), h: Math.max(min.h, rh) };
        d = { ...d, widgets: d.widgets.map((x) => (x.id === existing.id ? widget : x)) };
        stats.updated += 1;
        continue;
      }
      widget.layout = { ...place(type, w, h), w, h };
      d = { ...d, widgets: [...d.widgets, widget] };
      if (widget.type === "filter") newFilterIds.push(widget.id);
      stats.widgets += 1;
    }
  }

  // Wire new filters to every data widget whose dataset has the filter's field.
  if (newFilterIds.length) {
    const filters = d.widgets.filter((w) => newFilterIds.includes(w.id));
    const colCache = new Map<string, Set<string>>();
    const colsFor = (id: string) => {
      if (!colCache.has(id)) colCache.set(id, new Set(columnsOf(d, id).map((c) => c.name)));
      return colCache.get(id)!;
    };
    d = {
      ...d,
      widgets: d.widgets.map((w) => {
        if (!isDataBound(w) || !w.binding.datasetId) return w;
        const add = filters.filter((f) => f.type === "filter" && f.options.field && colsFor(w.binding.datasetId!).has(f.options.field)).map((f) => f.id);
        return add.length ? { ...w, binding: { ...w.binding, filterIds: [...new Set([...w.binding.filterIds, ...add])] } } : w;
      }),
    };
  }

  return { next: d, items, errorCount: items.reduce((n, i) => n + i.errors.length, 0), stats };
}
