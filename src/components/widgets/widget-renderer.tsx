"use client";

import * as React from "react";
import type { Widget } from "@/lib/model/types";
import { WidgetFrame } from "./widget-frame";
import { KpiView } from "./kpi-view";
import { ChartView } from "./chart-view";
import { TableView } from "./table-view";
import { TextView } from "./text-view";
import { FilterView } from "./filter-view";

export function WidgetBody({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case "kpi":
      return <KpiView widget={widget} />;
    case "line":
    case "bar":
      return <ChartView widget={widget} />;
    case "table":
      return <TableView widget={widget} />;
    case "text":
      return <TextView widget={widget} />;
    case "filter":
      return <FilterView widget={widget} />;
  }
}

export const WidgetRenderer = React.memo(function WidgetRenderer({ widget }: { widget: Widget }) {
  return (
    <WidgetFrame widget={widget} hideHeader={widget.type === "text"}>
      <WidgetBody widget={widget} />
    </WidgetFrame>
  );
});
