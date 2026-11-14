"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  EyeIcon,
  FileSpreadsheetIcon,
  FunctionSquareIcon,
  GripVerticalIcon,
  HashIcon,
  PlusIcon,
  TypeIcon,
} from "lucide-react";
import { getSalesSample } from "@/lib/data/samples";
import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Illustrative, static preview of the two builder tabs on the landing page. */
export function BuilderTabsPreview() {
  const [tab, setTab] = React.useState<"design" | "data">("design");
  const sales = React.useMemo(() => getSalesSample(), []);
  const rows = sales.rows.slice(0, 6);
  const kpis = React.useMemo(() => {
    const money = { kind: "compact" as const, decimals: 1, currency: "USD", percentScale: "fraction" as const };
    const rev = sales.rows.reduce((s, r) => s + Number(r.revenue), 0);
    const cost = sales.rows.reduce((s, r) => s + Number(r.cost), 0);
    return [
      ["Revenue", `$${formatValue(rev, money)}`],
      ["Orders", formatValue(sales.rows.length)],
      ["Margin", `$${formatValue(rev - cost, money)}`],
    ];
  }, [sales]);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-raised">
      <div className="grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-surface px-3 text-[13px]">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <ArrowLeftIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate font-medium text-foreground">Sales overview</span>
          <span className="hidden items-center gap-1 text-xs sm:inline-flex">
            <CheckIcon className="size-3 text-success" aria-hidden /> Saved
          </span>
        </div>
        <div role="tablist" aria-label="Builder tabs preview" className="flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5">
          {(["design", "data"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-[4px] px-3 py-0.5 text-xs font-medium capitalize transition-colors duration-150",
                tab === t ? "bg-surface text-foreground shadow-surface" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span className="hidden items-center gap-1 sm:inline-flex">
            <EyeIcon className="size-3.5" aria-hidden /> Preview
          </span>
          <span className="rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground">Save</span>
        </div>
      </div>

      <div key={tab} className="animate-fade-in">
        {tab === "design" ? (
          <div className="grid min-h-80 grid-cols-1 md:grid-cols-[1fr_220px]">
            <div className="relative border-border bg-dots p-4 md:border-r">
              <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-foreground shadow-surface">
                  <PlusIcon className="size-3" /> Add widget
                </span>
                <span className="rounded-md border border-border bg-surface px-2 py-1">Desktop</span>
              </div>
              <div className="grid grid-cols-6 gap-2.5">
                {kpis.map(([t, v], i) => (
                  <div key={t} className={cn("col-span-2 rounded-lg border bg-surface p-2.5 shadow-surface", i === 0 ? "border-focus ring-2 ring-focus/20" : "border-border")}>
                    <p className="text-[11px] text-muted-foreground">{t}</p>
                    <p className="font-semibold tabular">{v}</p>
                  </div>
                ))}
                <div className="col-span-6 h-32 rounded-lg border border-border bg-surface p-2.5 shadow-surface">
                  <p className="text-[11px] text-muted-foreground">Revenue by month</p>
                  <svg viewBox="0 0 300 80" className="mt-1 h-20 w-full" preserveAspectRatio="none" aria-hidden>
                    <path d="M0,62 C30,58 50,60 75,50 S120,44 150,40 S210,30 240,22 S280,14 300,10" fill="none" stroke="var(--chart-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>
              </div>
            </div>
            <aside className="border-t border-border bg-surface p-3 text-xs md:border-t-0" aria-label="Inspector preview">
              <p className="mb-2 font-medium">Revenue · KPI card</p>
              <dl className="grid gap-2">
                {[
                  ["Dataset", "Sales"],
                  ["Measure", "SUM(revenue)"],
                  ["Format", "Currency · USD"],
                  ["Filters", "Region, Order date"],
                ].map(([k, v]) => (
                  <div key={k} className="grid gap-1">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px]">{v}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        ) : (
          <div className="grid min-h-80 gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-focus bg-surface px-2 py-1 font-medium ring-2 ring-focus/15">
                <FileSpreadsheetIcon className="size-3.5" /> sales_orders.csv
              </span>
              <span className="rounded-md border border-border bg-surface px-2 py-1 text-muted-foreground">Regional targets</span>
              <span className="font-mono text-muted-foreground">{sales.rows.length.toLocaleString("en-US")} rows · {sales.columns.length} columns</span>
            </div>
            <div className="grid gap-3 md:grid-cols-[220px_1fr]">
              <ol className="grid content-start gap-1.5 text-xs" aria-label="Pipeline preview">
                {[
                  [FunctionSquareIcon, "margin = revenue - cost"],
                  [HashIcon, "units as number"],
                  [TypeIcon, "Filter region is not empty"],
                ].map(([Icon, label], i) => {
                  const I = Icon as typeof HashIcon;
                  return (
                    <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5">
                      <GripVerticalIcon className="size-3 text-muted-foreground" aria-hidden />
                      <span className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <I className="size-3.5 text-muted-foreground" aria-hidden />
                      <span className="truncate font-mono text-[11px]">{label as string}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[420px] text-xs tabular">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      {["order_date", "region", "revenue", "margin"].map((h) => (
                        <th key={h} className="h-7 px-2 text-left font-medium">
                          <span className="font-mono">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={String(r.order_id)} className="border-t border-border">
                        <td className="h-7 px-2 font-mono text-[11px]">{String(r.order_date)}</td>
                        <td className="px-2">{String(r.region)}</td>
                        <td className="px-2 font-mono text-[11px]">{formatValue(Number(r.revenue), { kind: "currency", decimals: 0, currency: "USD", percentScale: "fraction" })}</td>
                        <td className="px-2 font-mono text-[11px]">{formatValue(Number(r.revenue) - Number(r.cost), { kind: "currency", decimals: 0, currency: "USD", percentScale: "fraction" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
