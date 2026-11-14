import type {
  CellValue,
  ColumnSchema,
  DataBinding,
  DateGrain,
  DateRangePreset,
  FilterWidget,
  RawTable,
  Row,
} from "@/lib/model/types";
import { aggregate } from "./transform";
import { isEmpty } from "./schema";

// ---------- Dates ----------

export function bucketDate(iso: string, grain: DateGrain): string {
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  switch (grain) {
    case "year":
      return `${y}`;
    case "quarter":
      return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    case "month":
      return `${y}-${String(m).padStart(2, "0")}`;
    case "week": {
      const date = new Date(Date.UTC(y, m - 1, d));
      const day = (date.getUTCDay() + 6) % 7; // Monday start
      date.setUTCDate(date.getUTCDate() - day);
      return date.toISOString().slice(0, 10);
    }
    default:
      return s;
  }
}

function monthsBack(maxIso: string, months: number): string {
  const [y, m] = maxIso.slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - (months - 1), 1));
  return d.toISOString().slice(0, 10);
}

/** Date presets resolve relative to the latest date in the data so historical files stay meaningful. */
export function resolveRange(preset: DateRangePreset, maxIso: string | null): [string, string] | null {
  if (preset === "all" || !maxIso) return null;
  if (preset === "ytd") return [`${maxIso.slice(0, 4)}-01-01`, maxIso];
  const n = preset === "last_3_months" ? 3 : preset === "last_6_months" ? 6 : 12;
  return [monthsBack(maxIso, n), maxIso];
}

export const RANGE_LABELS: Record<DateRangePreset, string> = {
  all: "All time",
  last_3_months: "Last 3 months",
  last_6_months: "Last 6 months",
  last_12_months: "Last 12 months",
  ytd: "Year to date",
};

// ---------- Filters ----------

export interface FilterValue {
  values?: string[];
  range?: DateRangePreset;
}
export type FilterState = Record<string, FilterValue>;

export function maxDate(rows: Row[], field: string): string | null {
  let max: string | null = null;
  for (const r of rows) {
    const v = r[field];
    if (typeof v === "string" && (!max || v > max)) max = v;
  }
  return max;
}

/**
 * Apply dashboard filter widgets to a table. A filter applies when the widget
 * lists it in filterIds and the table has the filter's field (matched by name).
 */
export function applyFilters(
  table: RawTable,
  filterIds: string[],
  filters: FilterWidget[],
  state: FilterState,
): Row[] {
  let rows = table.rows;
  for (const id of filterIds) {
    const f = filters.find((x) => x.id === id);
    if (!f || !f.options.field) continue;
    const field = f.options.field;
    if (!table.columns.some((c) => c.name === field)) continue;
    const value = state[id] ?? defaultFilterValue(f);
    if (f.options.control === "date_range") {
      const range = resolveRange(value.range ?? "all", maxDate(table.rows, field));
      if (range) rows = rows.filter((r) => typeof r[field] === "string" && r[field]! >= range[0] && r[field]! <= range[1]);
    } else if (value.values && value.values.length > 0) {
      const set = new Set(value.values);
      rows = rows.filter((r) => set.has(String(r[field] ?? "")));
    }
  }
  return rows;
}

export function defaultFilterValue(f: FilterWidget): FilterValue {
  return f.options.control === "date_range" ? { range: f.options.defaultRange } : { values: f.options.defaultValues };
}

/** Sorted distinct values of a field: the stable domain used for colors and filter options. */
export function distinctValues(table: RawTable, field: string, limit = 200): string[] {
  const set = new Set<string>();
  for (const r of table.rows) {
    const v = r[field];
    if (!isEmpty(v)) set.add(String(v));
    if (set.size > limit) break;
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ---------- Aggregation ----------

export interface SeriesDef {
  key: string;
  label: string;
  /** 1-based palette slot. */
  color: number;
}

export interface ChartResult {
  data: Record<string, CellValue>[];
  series: SeriesDef[];
  dimensionType: ColumnSchema["type"] | null;
}

function dimKey(v: CellValue, type: ColumnSchema["type"] | undefined, grain: DateGrain): string {
  if (isEmpty(v)) return "(empty)";
  if (type === "date" && typeof v === "string") return bucketDate(v, grain);
  return String(v);
}

export function queryChart(
  table: RawTable,
  rows: Row[],
  binding: DataBinding,
  baseColor: number,
): ChartResult {
  const dimCol = binding.dimension ? table.columns.find((c) => c.name === binding.dimension) : undefined;
  const measures = binding.measures.filter((m) => m.agg === "count" || table.columns.some((c) => c.name === m.field));
  if (measures.length === 0) return { data: [], series: [], dimensionType: dimCol?.type ?? null };

  const seriesCol = binding.series ? table.columns.find((c) => c.name === binding.series) : undefined;
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = dimCol ? dimKey(r[dimCol.name], dimCol.type, binding.dateGrain) : "Total";
    const list = groups.get(k);
    if (list) list.push(r);
    else groups.set(k, [r]);
  }

  let series: SeriesDef[];
  let data: Record<string, CellValue>[];

  if (seriesCol) {
    const m = measures[0];
    // Domain from the unfiltered table keeps category colors stable while filtering.
    const domain = distinctValues(table, seriesCol.name, 24);
    series = domain.map((value, i) => ({ key: `s:${value}`, label: value, color: ((i % 8) + 1) }));
    data = [...groups].map(([k, list]) => {
      const point: Record<string, CellValue> = { __dim: k };
      const bySeries = new Map<string, Row[]>();
      for (const r of list) {
        const s = String(r[seriesCol.name] ?? "(empty)");
        const l = bySeries.get(s);
        if (l) l.push(r);
        else bySeries.set(s, [r]);
      }
      for (const s of series) {
        const l = bySeries.get(s.label);
        point[s.key] = l ? aggregate(l.map((r) => (m.agg === "count" ? 1 : r[m.field])), m.agg) : null;
      }
      point.__total = series.reduce((sum, s) => sum + (Number(point[s.key]) || 0), 0);
      return point;
    });
    const present = new Set<string>();
    data.forEach((d) => series.forEach((s) => d[s.key] !== null && present.add(s.key)));
    series = series.filter((s) => present.has(s.key));
  } else {
    series = measures.map((m, i) => ({
      key: `m${i}`,
      label: m.label || `${m.agg === "count" ? "Count" : `${aggLabel(m.agg)} of ${m.field}`}`,
      color: ((baseColor - 1 + i) % 8) + 1,
    }));
    data = [...groups].map(([k, list]) => {
      const point: Record<string, CellValue> = { __dim: k };
      measures.forEach((m, i) => {
        point[`m${i}`] = aggregate(list.map((r) => (m.agg === "count" ? 1 : r[m.field])), m.agg);
      });
      point.__total = Number(point.m0) || 0;
      return point;
    });
  }

  const dir = binding.sort.direction === "asc" ? 1 : -1;
  if (binding.sort.by === "measure") {
    data.sort((a, b) => ((Number(a.__total) || 0) - (Number(b.__total) || 0)) * dir);
  } else {
    data.sort((a, b) => {
      const av = a.__dim as string;
      const bv = b.__dim as string;
      if (dimCol?.type === "number") return (Number(av) - Number(bv)) * dir;
      return av.localeCompare(bv) * dir;
    });
  }
  if (binding.limit && binding.limit > 0) data = data.slice(0, binding.limit);
  return { data, series, dimensionType: dimCol?.type ?? null };
}

function aggLabel(fn: string) {
  return { sum: "Sum", avg: "Avg", count: "Count", count_distinct: "Distinct", min: "Min", max: "Max" }[fn] ?? fn;
}

export interface KpiResult {
  value: number | null;
  previous: number | null;
  current: number | null;
  currentLabel: string | null;
  previousLabel: string | null;
  sparkline: { k: string; v: number | null }[];
}

export function queryKpi(table: RawTable, rows: Row[], binding: DataBinding, dateField: string | null): KpiResult {
  const m = binding.measures[0];
  const empty: KpiResult = { value: null, previous: null, current: null, currentLabel: null, previousLabel: null, sparkline: [] };
  if (!m) return empty;
  if (m.agg !== "count" && !table.columns.some((c) => c.name === m.field)) return empty;
  const pick = (list: Row[]) => aggregate(list.map((r) => (m.agg === "count" ? 1 : r[m.field])), m.agg);
  const value = pick(rows);
  const dateCol = dateField ? table.columns.find((c) => c.name === dateField && c.type === "date") : undefined;
  if (!dateCol) return { ...empty, value };
  const byMonth = new Map<string, Row[]>();
  for (const r of rows) {
    const v = r[dateCol.name];
    if (typeof v !== "string") continue;
    const k = bucketDate(v, "month");
    const l = byMonth.get(k);
    if (l) l.push(r);
    else byMonth.set(k, [r]);
  }
  const keys = [...byMonth.keys()].sort();
  const sparkline = keys.map((k) => ({ k, v: pick(byMonth.get(k)!) }));
  const cur = keys.at(-1) ?? null;
  const prev = keys.at(-2) ?? null;
  return {
    value,
    sparkline,
    current: cur ? pick(byMonth.get(cur)!) : null,
    previous: prev ? pick(byMonth.get(prev)!) : null,
    currentLabel: cur,
    previousLabel: prev,
  };
}
