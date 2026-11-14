"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChevronRightIcon, CornerLeftUpIcon } from "lucide-react";
import type { BarWidget, ColumnSchema, DataBinding, LineWidget, Row } from "@/lib/model/types";
import { bucketDate, queryChart } from "@/lib/data/query";
import { cn } from "@/lib/utils";
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

interface DrillStep {
  field: string;
  /** Bucket key as shown on the axis (a date bucket for date fields). */
  key: string;
  type: ColumnSchema["type"] | undefined;
  grain: DataBinding["dateGrain"];
}

const humanize = (f: string) => f.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function matches(row: Row, step: DrillStep) {
  const v = row[step.field];
  if (v === null || v === undefined || v === "") return step.key === "(empty)";
  if (step.type === "date" && typeof v === "string") return bucketDate(v, step.grain) === step.key;
  return String(v) === step.key;
}

/**
 * Line and bar charts. Viewers can switch the X-axis between the dimension and
 * its alternate views, and click a bar or point to drill into the next level
 * of the drill path. Both are view state only; the saved binding is unchanged.
 */
export function ChartView({ widget }: { widget: LineWidget | BarWidget }) {
  const state = useWidgetData(widget);
  const { dashboard } = useRuntime();
  const reduced = usePrefersReducedMotion();
  const b = widget.binding;
  const columns = state.kind === "ready" ? state.table.columns : [];
  const has = (f: string) => columns.some((c) => c.name === f);
  const views = b.dimension ? [b.dimension, ...(b.views ?? []).filter((v) => v !== b.dimension && has(v))] : [];
  const levels = b.dimension ? [b.dimension, ...(b.drill ?? []).filter((v) => v !== b.dimension && has(v))] : [];

  const [view, setView] = React.useState<string | null>(null);
  const hoverRef = React.useRef<number | null>(null);
  const pressRef = React.useRef<{ x: number; y: number } | null>(null);
  const [path, setPath] = React.useState<DrillStep[]>([]);
  // Reset view state when the saved binding changes underneath it.
  const resetKey = `${b.datasetId}|${b.dimension}|${(b.views ?? []).join(",")}|${(b.drill ?? []).join(",")}`;
  const [lastKey, setLastKey] = React.useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setView(null);
    setPath([]);
  }

  const baseDim = view && views.includes(view) ? view : b.dimension;
  const levelIndex = path.length ? levels.indexOf(path[path.length - 1].field) + 1 : levels.indexOf(baseDim ?? "");
  const activeDim = path.length ? (levels[levelIndex] ?? baseDim) : baseDim;
  const nextLevel = levelIndex >= 0 ? levels[levelIndex + 1] : undefined;
  // Plain computation: the React Compiler memoizes this component.
  const result =
    state.kind === "ready"
      ? queryChart(state.table, path.length ? state.rows.filter((r) => path.every((p) => matches(r, p))) : state.rows, { ...b, dimension: activeDim }, widget.style.color)
      : null;

  if (state.kind === "no-data") return <NoDataState />;
  if (state.kind === "broken") return <BrokenBindingState issues={state.issues} widgetId={widget.id} />;
  if (state.kind === "needs-config") return <NeedsConfigState message={state.message} />;
  if (!result) return null;

  const dimType = columns.find((c) => c.name === activeDim)?.type;
  const fmtKey = (field: string, key: string, type: ColumnSchema["type"] | undefined, grain: DataBinding["dateGrain"]) =>
    type === "date" ? formatBucket(key, grain, widget.dateFormat.style) : key || humanize(field);
  const drillInto = nextLevel
    ? (key: string) => {
        if (!activeDim || key === undefined) return;
        setPath((p) => [...p, { field: activeDim, key, type: dimType, grain: b.dateGrain }]);
      }
    : null;
  // Drill on a plain click. Recharts' own click events are unreliable inside the editor
  // canvas (selecting a card re-renders the chart between mousedown and mouseup), so the
  // hovered category is tracked here and a short press without movement drills into it.
  const onPressStart = (e: React.PointerEvent) => {
    pressRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPressEnd = (e: React.PointerEvent) => {
    const start = pressRef.current;
    pressRef.current = null;
    if (!drillInto || !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) return;
    // Wait a tick so touch taps update the hovered category first.
    setTimeout(() => {
      const i = hoverRef.current;
      const key = i !== null ? result.data[i]?.__dim : undefined;
      if (key !== undefined && key !== null) drillInto(String(key));
    }, 0);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!drillInto || (e.key !== "Enter" && e.key !== " ")) return;
    const i = hoverRef.current;
    const key = i !== null ? result.data[i]?.__dim : undefined;
    if (key === undefined || key === null) return;
    e.preventDefault();
    e.stopPropagation();
    drillInto(String(key));
  };

  const toolbar =
    views.length > 1 || path.length || nextLevel ? (
      <div className="mb-1.5 flex min-w-0 items-center gap-2" data-no-drag onPointerDown={(e) => e.stopPropagation()}>
        <nav aria-label="Drill path" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden text-[11px] text-muted-foreground">
          {path.length ? (
            <>
              <button type="button" className="inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-muted hover:text-foreground" onClick={() => setPath((p) => p.slice(0, -1))} aria-label="Drill up one level">
                <CornerLeftUpIcon className="size-3" aria-hidden />
              </button>
              <button type="button" className="shrink-0 rounded px-1 py-0.5 hover:bg-muted hover:text-foreground" onClick={() => setPath([])}>
                All
              </button>
              {path.map((p, i) => (
                <React.Fragment key={i}>
                  <ChevronRightIcon className="size-3 shrink-0 opacity-60" aria-hidden />
                  <button
                    type="button"
                    className={cn("truncate rounded px-1 py-0.5 hover:bg-muted hover:text-foreground", i === path.length - 1 && "font-medium text-foreground")}
                    onClick={() => setPath((x) => x.slice(0, i + 1))}
                    aria-current={i === path.length - 1 ? "location" : undefined}
                  >
                    {fmtKey(p.field, p.key, p.type, p.grain)}
                  </button>
                </React.Fragment>
              ))}
              <ChevronRightIcon className="size-3 shrink-0 opacity-60" aria-hidden />
              <span className="truncate px-1">by {humanize(activeDim ?? "")}</span>
            </>
          ) : nextLevel ? (
            <span className="truncate px-1">Click a {widget.type === "bar" ? "bar" : "point"} to see {humanize(nextLevel)}</span>
          ) : null}
        </nav>
        {views.length > 1 && !path.length ? (
          <div role="radiogroup" aria-label="Group chart by" className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted p-0.5">
            {views.map((v) => {
              const active = (baseDim ?? "") === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setView(v);
                    setPath([]);
                  }}
                  className={cn(
                    "h-5 rounded-[4px] px-1.5 text-[11px] font-medium transition-colors",
                    active ? "bg-surface text-foreground shadow-surface" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {columns.find((c) => c.name === v)?.type === "date" ? humanize(b.dateGrain) : humanize(v)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="absolute inset-0 flex flex-col">
      {toolbar}
      <div
        className={cn("relative min-h-0 flex-1", drillInto && "cursor-pointer")}
        onPointerDown={drillInto ? onPressStart : undefined}
        onPointerUp={drillInto ? onPressEnd : undefined}
        onKeyDown={drillInto ? onKeyDown : undefined}
      >
        {result.data.length === 0 ? (
          <NoRowsState />
        ) : (
          <ChartBody
            widget={widget}
            result={result}
            dimType={dimType}
            onHover={(i) => {
              hoverRef.current = i;
            }}
            reduced={reduced}
            palette={dashboard.appearance.palette}
          />
        )}
      </div>
    </div>
  );
}

function ChartBody({
  widget,
  result,
  dimType,
  onHover,
  reduced,
  palette,
}: {
  widget: LineWidget | BarWidget;
  result: NonNullable<ReturnType<typeof queryChart>>;
  dimType: ColumnSchema["type"] | undefined;
  /** Reports the hovered or keyboard-focused category index, or null. */
  onHover: (index: number | null) => void;
  reduced: boolean;
  palette: "default" | "monochrome";
}) {
  const dashboard = { appearance: { palette } };

  const config: ChartConfig = Object.fromEntries(
    result.series.map((s) => [s.key, { label: s.label, color: seriesColor(s.color, dashboard.appearance.palette) }]),
  );
  const isDate = (dimType ?? result.dimensionType) === "date";
  const fmtDim = (v: unknown) => (isDate ? formatBucket(String(v), widget.binding.dateGrain, widget.dateFormat.style) : String(v));
  const fmtVal = (v: number) => formatValue(v, widget.format);
  const fmtAxis = (v: number) => formatAxis(v, widget.format);
  const o = widget.options;
  const anim = { isAnimationActive: !reduced, animationDuration: 450 };
  const legend = o.showLegend && result.series.length > 1;
  const track = {
    onMouseMove: (st: unknown) => {
      const i = Number((st as { activeTooltipIndex?: unknown } | null)?.activeTooltipIndex);
      onHover(Number.isFinite(i) && (st as { isTooltipActive?: boolean }).isTooltipActive !== false ? i : null);
    },
    onMouseLeave: () => onHover(null),
  };

  if (widget.type === "line") {
    return (
      <ChartContainer config={config} className="absolute inset-0">
        <LineChart data={result.data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} accessibilityLayer {...track}>
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
        {...track}
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
