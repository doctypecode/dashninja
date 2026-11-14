"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { BarWidget, LineWidget } from "@/lib/model/types";
import { queryChart } from "@/lib/data/query";
import { formatAxis, formatBucket, formatValue } from "@/lib/format";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  chartColorVar,
  type ChartConfig,
} from "@/components/ui/chart";
import { seriesColor, usePrefersReducedMotion, useRuntime } from "./runtime";
import { useWidgetData } from "./use-widget-data";
import { BrokenBindingState, NeedsConfigState, NoDataState, NoRowsState } from "./empty-states";

export function ChartView({ widget }: { widget: LineWidget | BarWidget }) {
  const state = useWidgetData(widget);
  const { dashboard } = useRuntime();
  const reduced = usePrefersReducedMotion();
  const result = React.useMemo(
    () => (state.kind === "ready" ? queryChart(state.table, state.rows, widget.binding, widget.style.color) : null),
    [state, widget.binding, widget.style.color],
  );

  if (state.kind === "no-data") return <NoDataState />;
  if (state.kind === "broken") return <BrokenBindingState issues={state.issues} widgetId={widget.id} />;
  if (state.kind === "needs-config") return <NeedsConfigState message={state.message} />;
  if (!result) return null;
  if (result.data.length === 0) return <NoRowsState />;

  const config: ChartConfig = Object.fromEntries(
    result.series.map((s) => [s.key, { label: s.label, color: seriesColor(s.color, dashboard.appearance.palette) }]),
  );
  const isDate = result.dimensionType === "date";
  const fmtDim = (v: unknown) => (isDate ? formatBucket(String(v), widget.binding.dateGrain, widget.dateFormat.style) : String(v));
  const fmtVal = (v: number) => formatValue(v, widget.format);
  const fmtAxis = (v: number) => formatAxis(v, widget.format);
  const o = widget.options;
  const anim = { isAnimationActive: !reduced, animationDuration: 450 };
  const legend = o.showLegend && result.series.length > 1;

  if (widget.type === "line") {
    return (
      <ChartContainer config={config} className="absolute inset-0">
        <LineChart data={result.data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
          {o.showGrid ? <CartesianGrid vertical={false} /> : null}
          <XAxis dataKey="__dim" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={fmtDim} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={fmtAxis} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={fmtDim} valueFormatter={fmtVal} />} />
          {legend ? <ChartLegend content={<ChartLegendContent />} /> : null}
          {result.series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              type={o.curve}
              stroke={chartColorVar(s.key)}
              strokeWidth={2}
              dot={o.showDots ? { r: 2.5, fill: chartColorVar(s.key), strokeWidth: 0 } : false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
              {...anim}
            />
          ))}
        </LineChart>
      </ChartContainer>
    );
  }

  const horizontal = o.orientation === "horizontal";
  return (
    <ChartContainer config={config} className="absolute inset-0">
      <BarChart
        data={result.data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        barCategoryGap="22%"
        accessibilityLayer
      >
        {o.showGrid ? <CartesianGrid vertical={horizontal} horizontal={!horizontal} /> : null}
        {horizontal ? (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={fmtAxis} />
            <YAxis type="category" dataKey="__dim" tickLine={false} axisLine={false} width={92} tickFormatter={fmtDim} />
          </>
        ) : (
          <>
            <XAxis dataKey="__dim" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} tickFormatter={fmtDim} />
            <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={fmtAxis} />
          </>
        )}
        <ChartTooltip cursor content={<ChartTooltipContent labelFormatter={fmtDim} valueFormatter={fmtVal} />} />
        {legend ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {result.series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={chartColorVar(s.key)}
            stackId={o.stacked ? "stack" : undefined}
            radius={o.stacked ? (i === result.series.length - 1 ? (horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]) : 0) : horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
            maxBarSize={40}
            {...anim}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
