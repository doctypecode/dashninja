import type { Dashboard, DataSource, Widget } from "./types";
import { DEFAULT_APPEARANCE, DEFAULT_CHART_OPTIONS, DEFAULT_STYLE, emptyBinding } from "./defaults";
import { getSalesSample, getTargetsSample } from "@/lib/data/samples";

/**
 * The clearly-labelled sample dashboard. Built from deterministic demo data so
 * that the landing preview, the /sample viewer and the workspace copy match.
 */

export const SAMPLE_IDS = {
  salesSource: "src_sample_sales",
  targetsSource: "src_sample_targets",
  salesDataset: "ds_sales",
  targetsDataset: "ds_targets",
  regionFilter: "w_filter_region",
  dateFilter: "w_filter_date",
};

function sampleSources(): DataSource[] {
  const sales = getSalesSample();
  const targets = getTargetsSample();
  return [
    {
      id: SAMPLE_IDS.salesSource,
      name: "sales_orders.csv",
      kind: "sample",
      status: "ready",
      config: { kind: "sample", sampleId: "sales" },
      rowCount: sales.rows.length,
      columnCount: sales.columns.length,
      lastRefreshedAt: "2026-11-01T08:00:00Z",
    },
    {
      id: SAMPLE_IDS.targetsSource,
      name: "Regional targets",
      kind: "sample",
      status: "ready",
      config: { kind: "sample", sampleId: "targets" },
      rowCount: targets.rows.length,
      columnCount: targets.columns.length,
      lastRefreshedAt: "2026-11-01T08:00:00Z",
    },
  ];
}

export function sampleWidgets(): Widget[] {
  const filters = [SAMPLE_IDS.regionFilter, SAMPLE_IDS.dateFilter];
  const ds = SAMPLE_IDS.salesDataset;
  const currency = { kind: "currency" as const, decimals: 0, currency: "USD", percentScale: "fraction" as const };
  const compactCurrency = { ...currency, kind: "currency" as const };
  return [
    {
      id: "w_heading",
      type: "text",
      title: "",
      description: "",
      layout: { x: 0, y: 0, w: 6, h: 2 },
      style: { ...DEFAULT_STYLE, background: "transparent", border: "none", padding: "compact" },
      options: { content: "Sales overview\nSynthetic demo data · Jan 2025 – Oct 2026", size: "xl" },
    },
    {
      id: SAMPLE_IDS.regionFilter,
      type: "filter",
      title: "Region",
      description: "",
      layout: { x: 6, y: 0, w: 3, h: 2 },
      style: { ...DEFAULT_STYLE, padding: "compact" },
      options: { datasetId: ds, field: "region", control: "select", defaultValues: [], defaultRange: "all" },
    },
    {
      id: SAMPLE_IDS.dateFilter,
      type: "filter",
      title: "Order date",
      description: "",
      layout: { x: 9, y: 0, w: 3, h: 2 },
      style: { ...DEFAULT_STYLE, padding: "compact" },
      options: { datasetId: ds, field: "order_date", control: "date_range", defaultValues: [], defaultRange: "last_12_months" },
    },
    {
      id: "w_kpi_revenue",
      type: "kpi",
      title: "Revenue",
      description: "SUM(revenue)",
      layout: { x: 0, y: 2, w: 3, h: 4 },
      style: { ...DEFAULT_STYLE, color: 1 },
      binding: { ...emptyBinding(ds), measures: [{ field: "revenue", agg: "sum" }], filterIds: filters },
      format: compactCurrency,
      options: { comparison: "previous_period", showSparkline: true, dateField: "order_date" },
    },
    {
      id: "w_kpi_orders",
      type: "kpi",
      title: "Orders",
      description: "COUNT(order_id)",
      layout: { x: 3, y: 2, w: 3, h: 4 },
      style: { ...DEFAULT_STYLE, color: 2 },
      binding: { ...emptyBinding(ds), measures: [{ field: "order_id", agg: "count" }], filterIds: filters },
      format: { kind: "number", decimals: 0, currency: "USD", percentScale: "fraction" },
      options: { comparison: "previous_period", showSparkline: true, dateField: "order_date" },
    },
    {
      id: "w_kpi_margin",
      type: "kpi",
      title: "Gross margin",
      description: "SUM(margin), where margin = revenue − cost",
      layout: { x: 6, y: 2, w: 3, h: 4 },
      style: { ...DEFAULT_STYLE, color: 6 },
      binding: { ...emptyBinding(ds), measures: [{ field: "margin", agg: "sum" }], filterIds: filters },
      format: compactCurrency,
      options: { comparison: "previous_period", showSparkline: true, dateField: "order_date" },
    },
    {
      id: "w_kpi_aov",
      type: "kpi",
      title: "Average order value",
      description: "AVG(revenue)",
      layout: { x: 9, y: 2, w: 3, h: 4 },
      style: { ...DEFAULT_STYLE, color: 4 },
      binding: { ...emptyBinding(ds), measures: [{ field: "revenue", agg: "avg" }], filterIds: filters },
      format: currency,
      options: { comparison: "previous_period", showSparkline: true, dateField: "order_date" },
    },
    {
      id: "w_line_revenue",
      type: "line",
      title: "Revenue by month",
      description: "Sales dataset · grouped by month · SUM(revenue)",
      layout: { x: 0, y: 6, w: 8, h: 9 },
      style: { ...DEFAULT_STYLE, color: 1 },
      binding: {
        ...emptyBinding(ds),
        dimension: "order_date",
        dateGrain: "month",
        measures: [{ field: "revenue", agg: "sum", label: "Revenue" }],
        filterIds: filters,
      },
      format: compactCurrency,
      dateFormat: { style: "auto" },
      options: { ...DEFAULT_CHART_OPTIONS, showLegend: false },
    },
    {
      id: "w_bar_region",
      type: "bar",
      title: "Revenue by region",
      description: "",
      layout: { x: 8, y: 6, w: 4, h: 9 },
      style: { ...DEFAULT_STYLE, color: 1 },
      binding: {
        ...emptyBinding(ds),
        dimension: "region",
        measures: [{ field: "revenue", agg: "sum", label: "Revenue" }],
        sort: { by: "measure", direction: "desc" },
        filterIds: filters,
        views: ["category", "channel"],
        drill: ["channel", "product"],
      },
      format: compactCurrency,
      dateFormat: { style: "auto" },
      options: { ...DEFAULT_CHART_OPTIONS, showLegend: false, orientation: "horizontal" },
    },
    {
      id: "w_bar_channel",
      type: "bar",
      title: "Revenue by category and channel",
      description: "",
      layout: { x: 0, y: 15, w: 6, h: 9 },
      style: { ...DEFAULT_STYLE, color: 1 },
      binding: {
        ...emptyBinding(ds),
        dimension: "category",
        series: "channel",
        measures: [{ field: "revenue", agg: "sum" }],
        sort: { by: "measure", direction: "desc" },
        filterIds: filters,
      },
      format: compactCurrency,
      dateFormat: { style: "auto" },
      options: { ...DEFAULT_CHART_OPTIONS, showLegend: true, stacked: true },
    },
    {
      id: "w_table_products",
      type: "table",
      title: "Products",
      description: "Units and revenue by product",
      layout: { x: 6, y: 15, w: 6, h: 9 },
      style: { ...DEFAULT_STYLE },
      binding: {
        ...emptyBinding(ds),
        dimension: "product",
        measures: [
          { field: "units", agg: "sum", label: "Units" },
          { field: "revenue", agg: "sum", label: "Revenue" },
          { field: "margin", agg: "sum", label: "Margin" },
        ],
        sort: { by: "measure", direction: "desc" },
        filterIds: filters,
      },
      format: currency,
      dateFormat: { style: "auto" },
      options: { pageSize: 7, striped: false },
    },
  ];
}

export function createSampleDashboard(id: string, workspaceId: string, now: string): Dashboard {
  return {
    id,
    workspaceId,
    name: "Sales overview (sample)",
    status: "published",
    isSample: true,
    createdAt: now,
    updatedAt: now,
    appearance: { ...DEFAULT_APPEARANCE },
    sources: sampleSources(),
    sourceData: {},
    datasets: [
      {
        id: SAMPLE_IDS.salesDataset,
        name: "Sales",
        sourceId: SAMPLE_IDS.salesSource,
        steps: [
          { id: "st_margin", enabled: true, type: "calculated", name: "margin", expression: "revenue - cost", resultType: "number" },
        ],
      },
      { id: SAMPLE_IDS.targetsDataset, name: "Targets", sourceId: SAMPLE_IDS.targetsSource, steps: [] },
    ],
    widgets: sampleWidgets(),
  };
}

export function createBlankDashboard(id: string, workspaceId: string, now: string, name = "Untitled dashboard"): Dashboard {
  return {
    id,
    workspaceId,
    name,
    status: "draft",
    isSample: false,
    createdAt: now,
    updatedAt: now,
    appearance: { ...DEFAULT_APPEARANCE },
    sources: [],
    sourceData: {},
    datasets: [],
    widgets: [],
  };
}

/** Starter variant: sample data connected, empty canvas. */
export function createStarterDashboard(id: string, workspaceId: string, now: string): Dashboard {
  const sample = createSampleDashboard(id, workspaceId, now);
  return { ...sample, name: "Untitled dashboard", status: "draft", isSample: false, widgets: [] };
}
