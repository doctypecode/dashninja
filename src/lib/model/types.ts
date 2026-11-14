/**
 * DashNinja domain model.
 *
 * Everything in a Dashboard is plain serializable JSON so it can be stored,
 * diffed for undo/redo, and later sent to a real API without changes.
 */

// ---------- Workspace ----------

export interface Workspace {
  id: string;
  name: string;
  kind: "personal" | "team";
  /** Demo flag: the team workspace is an illustrative empty workspace. */
  demo?: boolean;
}

// ---------- Data: schema ----------

export type ColumnType = "string" | "number" | "date" | "boolean";

export type CellValue = string | number | boolean | null;
export type Row = Record<string, CellValue>;

export interface ColumnSchema {
  name: string;
  type: ColumnType;
}

/** A tabular payload produced by a connector or a transformation pipeline. */
export interface RawTable {
  columns: ColumnSchema[];
  rows: Row[];
}

// ---------- Data: sources ----------

export type SourceKind = "csv" | "excel" | "google-sheets" | "sample";

export type SourceStatus =
  | "ready"
  | "importing"
  | "refreshing"
  | "error"
  | "disconnected"
  | "needs-auth";

export interface CsvConfig {
  kind: "csv";
  fileName: string;
  fileSize: number;
  delimiter: "auto" | "," | ";" | "\t" | "|";
  hasHeader: boolean;
}

export interface ExcelConfig {
  kind: "excel";
  fileName: string;
  fileSize: number;
  sheet: string;
  headerRow: number; // 1-based
  /** Optional A1 range, e.g. "A1:F200". Empty means the used range. */
  range: string;
}

export interface GoogleSheetsConfig {
  kind: "google-sheets";
  accountEmail: string | null;
  spreadsheetId: string | null;
  spreadsheetName: string | null;
  worksheet: string | null;
  range: string;
  refresh: "manual" | "hourly" | "daily";
}

export interface SampleConfig {
  kind: "sample";
  sampleId: "sales" | "targets";
}

export type SourceConfig = CsvConfig | ExcelConfig | GoogleSheetsConfig | SampleConfig;

export interface SourceError {
  code: string;
  message: string;
  detail?: string;
}

export interface DataSource {
  id: string;
  name: string;
  kind: SourceKind;
  status: SourceStatus;
  config: SourceConfig;
  rowCount: number;
  columnCount: number;
  lastRefreshedAt: string | null;
  error?: SourceError;
  /** Import warnings such as ragged rows or renamed headers. */
  warnings?: string[];
}

// ---------- Data: transformations ----------

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "not_empty";

export type AggregateFn = "sum" | "avg" | "count" | "count_distinct" | "min" | "max";

interface StepBase {
  id: string;
  enabled: boolean;
}

export type TransformStep =
  | (StepBase & { type: "rename"; column: string; to: string })
  | (StepBase & { type: "select"; mode: "keep" | "remove"; columns: string[] })
  | (StepBase & { type: "cast"; column: string; to: ColumnType })
  | (StepBase & { type: "filter"; column: string; operator: FilterOperator; value: string })
  | (StepBase & {
      type: "fill_empty";
      column: string;
      strategy: "value" | "zero" | "drop_row";
      value: string;
    })
  | (StepBase & { type: "calculated"; name: string; expression: string; resultType: "number" | "string" })
  | (StepBase & {
      type: "group";
      by: string[];
      aggregations: { column: string; fn: AggregateFn; as: string }[];
    });

export type TransformStepType = TransformStep["type"];

/** A named, prepared table: source + ordered pipeline. Widgets bind to datasets. */
export interface Dataset {
  id: string;
  name: string;
  sourceId: string;
  steps: TransformStep[];
}

// ---------- Design: widgets ----------

export type WidgetType = "kpi" | "line" | "bar" | "table" | "text" | "filter";

export interface GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DateGrain = "day" | "week" | "month" | "quarter" | "year";

export interface Measure {
  field: string;
  agg: AggregateFn;
  label?: string;
}

export interface DataBinding {
  datasetId: string | null;
  /** Grouping field: x-axis for charts, row group for tables. */
  dimension: string | null;
  dateGrain: DateGrain;
  measures: Measure[];
  /** Optional series split (line/bar). */
  series: string | null;
  /** Raw columns for an ungrouped table. */
  columns: string[];
  sort: { by: "dimension" | "measure"; direction: "asc" | "desc" };
  limit: number | null;
  /** Ids of dashboard filter widgets that apply to this widget. */
  filterIds: string[];
}

export type NumberFormatKind = "number" | "compact" | "currency" | "percent";

export interface ValueFormat {
  kind: NumberFormatKind;
  decimals: number;
  currency: string;
  /** For percent: whether values are already 0–100 (true) or 0–1 (false). */
  percentScale: "fraction" | "whole";
}

export interface DateFormat {
  style: "auto" | "short" | "long" | "iso";
}

export type ChartColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface WidgetStyle {
  background: "surface" | "muted" | "transparent";
  border: "default" | "none" | "strong";
  padding: "compact" | "normal" | "relaxed";
  titleSize: "sm" | "md" | "lg";
  align: "left" | "center";
  color: ChartColor;
}

export interface KpiOptions {
  comparison: "none" | "previous_period";
  showSparkline: boolean;
  /** Date field used for sparkline and period comparison. */
  dateField: string | null;
}

export interface ChartOptions {
  showLegend: boolean;
  showGrid: boolean;
  showDots: boolean;
  stacked: boolean;
  orientation: "vertical" | "horizontal";
  curve: "monotone" | "linear" | "step";
}

export interface TextOptions {
  content: string;
  size: "sm" | "md" | "lg" | "xl";
}

export interface FilterOptions {
  datasetId: string | null;
  field: string | null;
  control: "select" | "date_range";
  /** Default selection persisted with the dashboard. */
  defaultValues: string[];
  defaultRange: DateRangePreset;
}

export type DateRangePreset = "all" | "last_3_months" | "last_6_months" | "last_12_months" | "ytd";

export interface WidgetBase {
  id: string;
  type: WidgetType;
  title: string;
  description: string;
  layout: GridRect;
  style: WidgetStyle;
}

export interface KpiWidget extends WidgetBase {
  type: "kpi";
  binding: DataBinding;
  format: ValueFormat;
  options: KpiOptions;
}
export interface LineWidget extends WidgetBase {
  type: "line";
  binding: DataBinding;
  format: ValueFormat;
  dateFormat: DateFormat;
  options: ChartOptions;
}
export interface BarWidget extends WidgetBase {
  type: "bar";
  binding: DataBinding;
  format: ValueFormat;
  dateFormat: DateFormat;
  options: ChartOptions;
}
export interface TableWidget extends WidgetBase {
  type: "table";
  binding: DataBinding;
  format: ValueFormat;
  dateFormat: DateFormat;
  options: { pageSize: number; striped: boolean };
}
export interface TextWidget extends WidgetBase {
  type: "text";
  options: TextOptions;
}
export interface FilterWidget extends WidgetBase {
  type: "filter";
  options: FilterOptions;
}

export type Widget = KpiWidget | LineWidget | BarWidget | TableWidget | TextWidget | FilterWidget;
export type DataWidget = KpiWidget | LineWidget | BarWidget | TableWidget;

export function isDataWidget(w: Widget): w is DataWidget {
  return w.type === "kpi" || w.type === "line" || w.type === "bar" || w.type === "table";
}

// ---------- Dashboard ----------

export interface DashboardAppearance {
  background: "plain" | "dots" | "grid";
  density: "compact" | "comfortable";
  /** Gap between grid cells, px. */
  gap: 8 | 12 | 16;
  rowHeight: 28 | 32 | 40;
  palette: "default" | "monochrome";
  maxWidth: "full" | "wide" | "narrow";
}

export type DashboardStatus = "draft" | "published";

export interface Dashboard {
  id: string;
  workspaceId: string;
  name: string;
  status: DashboardStatus;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  appearance: DashboardAppearance;
  sources: DataSource[];
  /** Imported rows for file-based sources, keyed by source id. Sample and Sheets sources re-fetch. */
  sourceData: Record<string, RawTable>;
  datasets: Dataset[];
  widgets: Widget[];
}

/** Lightweight row for the workspace list. */
export interface DashboardSummary {
  id: string;
  workspaceId: string;
  name: string;
  status: DashboardStatus;
  isSample: boolean;
  updatedAt: string;
  sourceSummary: string;
  widgetCount: number;
  thumbnail: { type: WidgetType; layout: GridRect }[];
}

export const GRID_COLUMNS = 12;
