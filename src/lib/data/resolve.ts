import type { Dashboard, Dataset, RawTable, Widget } from "@/lib/model/types";
import { isDataWidget } from "@/lib/model/types";
import { getSourceTable } from "@/lib/connectors";
import { runPipeline, type PipelineResult } from "./transform";

/**
 * Resolve a dataset to its prepared table. Results are memoised on the
 * (source table, steps) identities, which change only when the draft changes.
 */
const cache = new WeakMap<RawTable, WeakMap<Dataset["steps"], PipelineResult>>();

export function resolveDataset(dashboard: Pick<Dashboard, "sources" | "sourceData">, dataset: Dataset): PipelineResult | null {
  const source = dashboard.sources.find((s) => s.id === dataset.sourceId);
  if (!source) return null;
  const input = getSourceTable(dashboard, source);
  let byInput = cache.get(input);
  if (!byInput) {
    byInput = new WeakMap();
    cache.set(input, byInput);
  }
  const hit = byInput.get(dataset.steps);
  if (hit) return hit;
  const result = runPipeline(input, dataset.steps);
  byInput.set(dataset.steps, result);
  return result;
}

export function resolveAll(dashboard: Pick<Dashboard, "sources" | "sourceData" | "datasets">): Map<string, RawTable> {
  const out = new Map<string, RawTable>();
  for (const ds of dashboard.datasets) {
    const r = resolveDataset(dashboard, ds);
    if (r) out.set(ds.id, r.table);
  }
  return out;
}

export interface BindingIssue {
  widgetId: string;
  widgetTitle: string;
  role: "dataset" | "dimension" | "series" | "measure" | "column" | "filter" | "date";
  field: string | null;
  message: string;
}

/**
 * Find widget bindings that reference fields or datasets that no longer exist.
 * Never substitutes another field: the UI asks the user to repair explicitly.
 */
export function findBindingIssues(widgets: Widget[], tables: Map<string, RawTable>, datasetNames: Map<string, string>): BindingIssue[] {
  const issues: BindingIssue[] = [];
  for (const w of widgets) {
    const title = w.title || "Untitled widget";
    const push = (role: BindingIssue["role"], field: string | null, message: string) =>
      issues.push({ widgetId: w.id, widgetTitle: title, role, field, message });

    if (w.type === "filter") {
      const { datasetId, field } = w.options;
      if (!datasetId) continue;
      const t = tables.get(datasetId);
      if (!t) {
        push("dataset", null, "Its dataset was removed.");
        continue;
      }
      if (field && !t.columns.some((c) => c.name === field))
        push("filter", field, `Field “${field}” is no longer in ${datasetNames.get(datasetId) ?? "the dataset"}.`);
      continue;
    }
    if (!isDataWidget(w)) continue;
    const b = w.binding;
    if (!b.datasetId) continue;
    const t = tables.get(b.datasetId);
    if (!t) {
      push("dataset", null, "Its dataset was removed.");
      continue;
    }
    const dsName = datasetNames.get(b.datasetId) ?? "the dataset";
    const has = (f: string) => t.columns.some((c) => c.name === f);
    if (b.dimension && !has(b.dimension)) push("dimension", b.dimension, `Group-by field “${b.dimension}” is no longer in ${dsName}.`);
    if (b.series && !has(b.series)) push("series", b.series, `Series field “${b.series}” is no longer in ${dsName}.`);
    for (const m of b.measures) {
      if (m.agg === "count") continue;
      if (!has(m.field)) push("measure", m.field, `Measure field “${m.field}” is no longer in ${dsName}.`);
      else if (["sum", "avg", "min", "max"].includes(m.agg) && t.columns.find((c) => c.name === m.field)?.type !== "number")
        push("measure", m.field, `“${m.field}” is not a number, so ${m.agg.toUpperCase()} can't be computed.`);
    }
    for (const c of b.columns) if (!has(c)) push("column", c, `Column “${c}” is no longer in ${dsName}.`);
    if (w.type === "kpi" && w.options.dateField && !has(w.options.dateField))
      push("date", w.options.dateField, `Date field “${w.options.dateField}” is no longer in ${dsName}.`);
  }
  return issues;
}
