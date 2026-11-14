"use client";

/**
 * shadcn/ui Charts, adapted for Recharts 3 and DashNinja tokens.
 * ChartContainer injects `--color-<key>` CSS variables from a ChartConfig so
 * series colors come from semantic tokens and work in both themes.
 */
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  { label?: React.ReactNode; icon?: React.ComponentType; color?: string }
>;

type ChartContextProps = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextProps | null>(null);

export function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within a <ChartContainer />");
  return ctx;
}

function cssKey(key: string) {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function chartColorVar(key: string) {
  return `var(--color-${cssKey(key)})`;
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;
  const style = Object.fromEntries(
    Object.entries(config)
      .filter(([, c]) => c.color)
      .map(([k, c]) => [`--color-${cssKey(k)}`, c.color]),
  ) as React.CSSProperties;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        style={style}
        className={cn(
          "flex min-h-0 w-full justify-center text-[11px] tabular",
          "[&_.recharts-cartesian-axis-tick_text]:fill-(--chart-axis) [&_.recharts-cartesian-grid_line]:stroke-(--chart-grid)",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border-strong [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-surface]:outline-hidden [&_.recharts-sector]:outline-hidden",
          className,
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer initialDimension={{ width: 320, height: 200 }}>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;
export const ChartLegend = RechartsPrimitive.Legend;

type TooltipItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string | null;
  color?: string;
  payload?: Record<string, unknown>;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  hideLabel,
  indicator = "dot",
  className,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipItem>;
  label?: React.ReactNode;
  labelFormatter?: (label: unknown) => React.ReactNode;
  valueFormatter?: (value: number) => React.ReactNode;
  hideLabel?: boolean;
  indicator?: "dot" | "line";
  className?: string;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;
  return (
    <div
      className={cn(
        "grid min-w-36 gap-1.5 rounded-md border border-border bg-popover px-2.5 py-2 text-xs shadow-raised",
        className,
      )}
    >
      {!hideLabel && (
        <div className="font-medium text-foreground">{labelFormatter ? labelFormatter(label) : label}</div>
      )}
      <div className="grid gap-1">
        {payload
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => {
            const key = String(item.dataKey ?? item.name ?? "value");
            const itemConfig = config[key];
            return (
              <div key={key} className="flex items-center gap-2">
                <span
                  className={cn("shrink-0 rounded-[2px]", indicator === "dot" ? "size-2" : "h-3 w-1")}
                  style={{ background: item.color ?? chartColorVar(key) }}
                />
                <span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
                <span className="ml-auto pl-3 font-mono font-medium text-foreground tabular">
                  {typeof item.value === "number" && valueFormatter ? valueFormatter(item.value) : String(item.value)}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export function ChartLegendContent({
  payload,
  className,
}: {
  payload?: ReadonlyArray<{ value?: unknown; dataKey?: unknown; color?: string }>;
  className?: string;
}) {
  const { config } = useChart();
  if (!payload?.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-2", className)}>
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.value ?? "");
        return (
          <div key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: item.color }} />
            {config[key]?.label ?? String(item.value ?? key)}
          </div>
        );
      })}
    </div>
  );
}
