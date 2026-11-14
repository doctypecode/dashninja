"use client";

import * as React from "react";
import type { DataWidget, RawTable, Row } from "@/lib/model/types";
import { applyFilters } from "@/lib/data/query";
import type { BindingIssue } from "@/lib/data/resolve";
import { useRuntime } from "./runtime";

export type WidgetDataState =
  | { kind: "no-data" }
  | { kind: "broken"; issues: BindingIssue[] }
  | { kind: "needs-config"; message: string }
  | { kind: "ready"; table: RawTable; rows: Row[] };

export function useWidgetData(widget: DataWidget): WidgetDataState {
  const { tables, filters, filterState, issuesByWidget } = useRuntime();
  const b = widget.binding;
  const table = b.datasetId ? tables.get(b.datasetId) : undefined;
  const issues = issuesByWidget.get(widget.id);
  const rows = React.useMemo(
    () => (table ? applyFilters(table, b.filterIds, filters, filterState) : []),
    [table, b.filterIds, filters, filterState],
  );
  if (!b.datasetId) return { kind: "no-data" };
  if (issues?.length) return { kind: "broken", issues };
  if (!table) return { kind: "no-data" };
  if (widget.type === "table") {
    if (!b.dimension && b.columns.length === 0) return { kind: "needs-config", message: "Pick columns, or a group-by field and measures." };
    if (b.dimension && b.measures.length === 0) return { kind: "needs-config", message: "Add a measure to summarise each group." };
  } else if (b.measures.length === 0) {
    return { kind: "needs-config", message: "Add a measure in the inspector." };
  } else if (widget.type !== "kpi" && !b.dimension) {
    return { kind: "needs-config", message: "Choose an X-axis field to group by." };
  }
  return { kind: "ready", table, rows };
}
