import type { ColumnSchema, Dashboard, Row, TransformStep } from "@/lib/model/types";
import { resolveDataset } from "@/lib/data/resolve";
import { isDataBound } from "@/lib/builder/store";
import type { UsageSummary } from "./usage-types";
import { specFromWidget } from "./plan";

export type AiMode = "plan" | "auto";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DatasetContext {
  id: string;
  name: string;
  source: string;
  steps: TransformStep[];
  columns: ColumnSchema[];
  rowCount: number;
  sampleRows: Row[];
  usedColumns: string[];
}

export interface AiContext {
  dashboardTitle: string;
  selectedDatasetId: string | null;
  datasets: DatasetContext[];
  /** Widgets already on the Design canvas (empty means Design is blank). */
  widgets: { id: string; type: string; title: string; datasetId: string | null; fields: string[] }[];
  /** Widgets the user attached to this message from the canvas, as full add_widget specs with their id. */
  attachedWidgets?: Record<string, unknown>[];
}

export interface AiChatRequest {
  model: string;
  mode: AiMode;
  messages: AiChatMessage[];
  context: AiContext;
}

export interface AiChatResponse {
  content: string;
  model: string;
  /** What this one reply cost. */
  cost?: { usd: number; promptTokens: number; completionTokens: number; estimated: boolean };
  usage?: UsageSummary;
}

/** Step as the model writes it: no id/enabled. */
export type DraftStep = Omit<TransformStep, "id" | "enabled">;

export interface AddWidgetAction {
  type: "add_widget";
  widget: "kpi" | "line" | "bar" | "table" | "text" | "filter";
  title?: string;
  /** Dataset id, dataset name, or the `ref` of a new_dataset earlier in the same reply. */
  dataset?: string;
  dimension?: string;
  dateGrain?: string;
  measures?: { field: string; agg: string; label?: string }[];
  series?: string;
  columns?: string[];
  sort?: { by: string; direction: string };
  limit?: number;
  format?: string;
  dateField?: string;
  field?: string;
  control?: string;
  defaultRange?: string;
  content?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export type AiAction =
  | { type: "add_steps"; datasetId: string; steps: DraftStep[] }
  | { type: "new_dataset"; fromDatasetId: string; name: string; ref?: string; steps: DraftStep[] }
  | AddWidgetAction
  | (Partial<Omit<AddWidgetAction, "type">> & { type: "update_widget"; id: string })
  | { type: "remove_widget"; id: string };

const SAMPLE_ROWS = 15;

export function buildContext(d: Dashboard, selectedDatasetId: string | null, attachedWidgetIds: string[] = []): AiContext {
  const used = new Map<string, Set<string>>();
  for (const w of d.widgets) {
    if (!isDataBound(w) || !w.binding.datasetId) continue;
    const set = used.get(w.binding.datasetId) ?? new Set<string>();
    const bnd = w.binding;
    [bnd.dimension, bnd.series, ...bnd.columns, ...bnd.measures.map((m) => m.field)].forEach((c) => c && set.add(c));
    if (w.type === "kpi" && w.options.dateField) set.add(w.options.dateField);
    used.set(w.binding.datasetId, set);
  }
  return {
    dashboardTitle: d.name,
    attachedWidgets: d.widgets.filter((w) => attachedWidgetIds.includes(w.id)).map((w) => ({ id: w.id, ...specFromWidget(w) })),
    widgets: d.widgets.map((w) => ({
      id: w.id,
      type: w.type,
      title: w.title,
      datasetId: isDataBound(w) ? w.binding.datasetId : w.type === "filter" ? w.options.datasetId : null,
      fields: isDataBound(w)
        ? [w.binding.dimension, w.binding.series, ...w.binding.columns, ...w.binding.measures.map((m) => `${m.agg}(${m.field})`)].filter((x): x is string => Boolean(x))
        : w.type === "filter" && w.options.field
          ? [w.options.field]
          : [],
    })),
    selectedDatasetId,
    datasets: d.datasets.map((ds) => {
      const result = resolveDataset(d, ds);
      const source = d.sources.find((s) => s.id === ds.sourceId);
      return {
        id: ds.id,
        name: ds.name,
        source: source?.name ?? "unknown",
        steps: ds.steps,
        columns: result?.table.columns ?? [],
        rowCount: result?.table.rows.length ?? 0,
        sampleRows: result?.table.rows.slice(0, SAMPLE_ROWS) ?? [],
        usedColumns: [...(used.get(ds.id) ?? [])],
      };
    }),
  };
}

const STEP_TYPES = new Set(["rename", "select", "cast", "filter", "fill_empty", "calculated", "group"]);
const OPERATORS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "not_contains", "is_empty", "not_empty"]);
const AGGS = new Set(["sum", "avg", "count", "count_distinct", "min", "max"]);
const TYPES = new Set(["string", "number", "date", "boolean"]);

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const strArr = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/** Coerce one model-written step into a TransformStep, or explain why it can't. */
export function normalizeStep(raw: unknown, id: string): { step: TransformStep } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Step is not an object" };
  const r = raw as Record<string, unknown>;
  const type = str(r.type);
  if (!STEP_TYPES.has(type)) return { error: `Unknown step type “${type}”` };
  const base = { id, enabled: true };
  switch (type) {
    case "rename":
      if (!str(r.column) || !str(r.to)) return { error: "Rename needs column and to" };
      return { step: { ...base, type, column: str(r.column), to: str(r.to) } };
    case "select": {
      const mode = r.mode === "remove" ? "remove" : "keep";
      const columns = strArr(r.columns);
      if (!columns.length) return { error: "Select needs at least one column" };
      return { step: { ...base, type, mode, columns } };
    }
    case "cast":
      if (!str(r.column) || !TYPES.has(str(r.to))) return { error: "Change type needs column and a valid type" };
      return { step: { ...base, type, column: str(r.column), to: str(r.to) as ColumnSchema["type"] } };
    case "filter": {
      const operator = str(r.operator);
      if (!str(r.column) || !OPERATORS.has(operator)) return { error: "Filter needs column and a valid operator" };
      return { step: { ...base, type, column: str(r.column), operator: operator as never, value: str(r.value) } };
    }
    case "fill_empty": {
      const strategy = ["value", "zero", "drop_row"].includes(str(r.strategy)) ? (str(r.strategy) as "value" | "zero" | "drop_row") : "value";
      if (!str(r.column)) return { error: "Handle empty values needs a column" };
      return { step: { ...base, type, column: str(r.column), strategy, value: str(r.value) } };
    }
    case "calculated": {
      if (!str(r.name) || !str(r.expression)) return { error: "Calculated column needs name and expression" };
      const resultType = r.resultType === "string" ? "string" : "number";
      return { step: { ...base, type, name: str(r.name), expression: str(r.expression), resultType } };
    }
    case "group": {
      const by = strArr(r.by);
      const aggregations = (Array.isArray(r.aggregations) ? r.aggregations : [])
        .map((a) => a as Record<string, unknown>)
        .filter((a) => a && AGGS.has(str(a.fn)))
        .map((a) => ({ column: str(a.column), fn: str(a.fn) as never, as: str(a.as) || `${str(a.fn)}_${str(a.column)}` }));
      if (!by.length && !aggregations.length) return { error: "Group needs group-by columns or aggregations" };
      return { step: { ...base, type, by, aggregations } };
    }
  }
  return { error: "Unsupported step" };
}

/** Split a reply into prose and the trailing ```json actions block, if any. */
export function parseReply(content: string): { text: string; actions: AiAction[]; parseError: string | null } {
  const re = /```(?:json)?\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((match = re.exec(content))) if (/"actions"/.test(match[1])) last = match;
  if (!last) return { text: content.trim(), actions: [], parseError: null };
  const text = (content.slice(0, last.index) + content.slice(last.index + last[0].length)).trim();
  try {
    const json = JSON.parse(last[1]) as { actions?: unknown };
    const actions = (Array.isArray(json.actions) ? json.actions : []).filter((a): a is AiAction => {
      const t = (a as { type?: string })?.type;
      if (t === "add_widget" || t === "update_widget" || t === "remove_widget") return true;
      return (t === "add_steps" || t === "new_dataset") && Array.isArray((a as { steps?: unknown }).steps);
    });
    return { text, actions, parseError: null };
  } catch {
    return { text, actions: [], parseError: "The assistant's proposal wasn't valid JSON, so nothing can be applied." };
  }
}
