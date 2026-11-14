"use client";

import * as React from "react";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import type { KpiWidget } from "@/lib/model/types";
import { queryKpi } from "@/lib/data/query";
import { formatBucket, formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRuntime, seriesColor } from "./runtime";
import { useWidgetData } from "./use-widget-data";
import { BrokenBindingState, NeedsConfigState, NoDataState } from "./empty-states";

export function KpiView({ widget }: { widget: KpiWidget }) {
  const state = useWidgetData(widget);
  const { dashboard } = useRuntime();
  const result = React.useMemo(
    () => (state.kind === "ready" ? queryKpi(state.table, state.rows, widget.binding, widget.options.dateField) : null),
    [state, widget.binding, widget.options.dateField],
  );
  if (state.kind === "no-data") return <NoDataState compact />;
  if (state.kind === "broken") return <BrokenBindingState issues={state.issues} widgetId={widget.id} />;
  if (state.kind === "needs-config") return <NeedsConfigState message={state.message} />;
  if (!result) return null;

  const delta =
    widget.options.comparison === "previous_period" && result.current !== null && result.previous
      ? (result.current - result.previous) / Math.abs(result.previous)
      : null;
  const color = seriesColor(widget.style.color, dashboard.appearance.palette);

  return (
    <div className={cn("flex h-full flex-col justify-between gap-1", widget.style.align === "center" && "items-center")}>
      <div className="font-semibold tracking-tight text-foreground tabular text-[clamp(1.25rem,2.2vw,1.75rem)] leading-none">
        {formatValue(result.value, widget.format)}
      </div>
      <div className="flex min-w-0 items-end justify-between gap-2">
        {delta !== null ? (
          <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium tabular",
                delta > 0.001 ? "text-success" : delta < -0.001 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {delta > 0.001 ? (
                <ArrowUpRightIcon className="size-3.5" aria-hidden />
              ) : delta < -0.001 ? (
                <ArrowDownRightIcon className="size-3.5" aria-hidden />
              ) : (
                <MinusIcon className="size-3.5" aria-hidden />
              )}
              <span className="sr-only">{delta > 0 ? "Up" : delta < 0 ? "Down" : "No change"}</span>
              {Math.abs(delta * 100).toFixed(1)}%
            </span>
            <span className="truncate">
              {result.currentLabel ? formatBucket(result.currentLabel, "month") : ""} vs prior month
            </span>
          </p>
        ) : (
          <span />
        )}
        {widget.options.showSparkline && result.sparkline.length > 1 ? (
          <Sparkline points={result.sparkline.map((p) => p.v ?? 0)} color={color} />
        ) : null}
      </div>
    </div>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 88;
  const h = 26;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - ((p - min) / span) * (h - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible" aria-hidden>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity={0.1} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="[stroke-dasharray:1] animate-draw" />
    </svg>
  );
}
