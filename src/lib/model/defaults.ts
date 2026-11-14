import type {
  ChartOptions,
  DashboardAppearance,
  DataBinding,
  ValueFormat,
  Widget,
  WidgetStyle,
  WidgetType,
} from "./types";
import { uid } from "@/lib/utils";

export const WIDGET_MIN_SIZE: Record<WidgetType, { w: number; h: number }> = {
  kpi: { w: 2, h: 3 },
  line: { w: 4, h: 6 },
  bar: { w: 3, h: 6 },
  table: { w: 4, h: 6 },
  text: { w: 2, h: 2 },
  filter: { w: 2, h: 2 },
};

export const WIDGET_DEFAULT_SIZE: Record<WidgetType, { w: number; h: number }> = {
  kpi: { w: 3, h: 4 },
  line: { w: 8, h: 9 },
  bar: { w: 4, h: 9 },
  table: { w: 6, h: 9 },
  text: { w: 4, h: 3 },
  filter: { w: 3, h: 2 },
};

export const WIDGET_LABELS: Record<WidgetType, string> = {
  kpi: "KPI card",
  line: "Line chart",
  bar: "Bar chart",
  table: "Table",
  text: "Text",
  filter: "Dashboard filter",
};

export const WIDGET_DESCRIPTIONS: Record<WidgetType, string> = {
  kpi: "One headline number with trend",
  line: "Change over time",
  bar: "Compare categories",
  table: "Rows or grouped values",
  text: "Headings and notes",
  filter: "Let viewers slice the dashboard",
};

export const DEFAULT_STYLE: WidgetStyle = {
  background: "surface",
  border: "default",
  padding: "normal",
  titleSize: "sm",
  align: "left",
  color: 1,
};

export const DEFAULT_FORMAT: ValueFormat = { kind: "number", decimals: 0, currency: "USD", percentScale: "fraction" };

export const DEFAULT_CHART_OPTIONS: ChartOptions = {
  showLegend: true,
  showGrid: true,
  showDots: false,
  stacked: false,
  orientation: "vertical",
  curve: "monotone",
};

export const DEFAULT_APPEARANCE: DashboardAppearance = {
  background: "plain",
  density: "comfortable",
  gap: 12,
  rowHeight: 32,
  palette: "default",
  maxWidth: "wide",
};

export function emptyBinding(datasetId: string | null = null): DataBinding {
  return {
    datasetId,
    dimension: null,
    dateGrain: "month",
    measures: [],
    series: null,
    columns: [],
    sort: { by: "dimension", direction: "asc" },
    limit: null,
    filterIds: [],
  };
}

export function createWidget(type: WidgetType, at: { x: number; y: number }, datasetId: string | null = null): Widget {
  const size = WIDGET_DEFAULT_SIZE[type];
  const base = {
    id: uid("w"),
    title: type === "text" ? "" : WIDGET_LABELS[type],
    description: "",
    layout: { x: at.x, y: at.y, w: size.w, h: size.h },
    style: { ...DEFAULT_STYLE },
  };
  switch (type) {
    case "kpi":
      return {
        ...base,
        type,
        binding: emptyBinding(datasetId),
        format: { ...DEFAULT_FORMAT },
        options: { comparison: "previous_period", showSparkline: true, dateField: null },
      };
    case "line":
    case "bar":
      return {
        ...base,
        type,
        binding: { ...emptyBinding(datasetId), sort: type === "bar" ? { by: "measure", direction: "desc" } : { by: "dimension", direction: "asc" } },
        format: { ...DEFAULT_FORMAT },
        dateFormat: { style: "auto" },
        options: { ...DEFAULT_CHART_OPTIONS, showLegend: false },
      } as Widget;
    case "table":
      return {
        ...base,
        type,
        binding: emptyBinding(datasetId),
        format: { ...DEFAULT_FORMAT },
        dateFormat: { style: "auto" },
        options: { pageSize: 8, striped: false },
      };
    case "text":
      return { ...base, type, style: { ...DEFAULT_STYLE, background: "transparent", border: "none" }, options: { content: "Add a heading or note", size: "lg" } };
    case "filter":
      return {
        ...base,
        type,
        title: "Filter",
        options: { datasetId, field: null, control: "select", defaultValues: [], defaultRange: "all" },
      };
  }
}
