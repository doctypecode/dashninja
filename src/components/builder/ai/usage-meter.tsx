"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, InfoIcon } from "lucide-react";
import type { UsageSummary } from "@/lib/ai/usage-types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const USAGE_QUERY_KEY = ["ai-usage"] as const;

export function useAiUsage() {
  return useQuery({
    queryKey: USAGE_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/ai/usage");
      if (!res.ok) throw new Error("usage");
      return (await res.json()) as UsageSummary;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Dollars, with more precision for the small amounts a single request costs. */
export function usd(n: number) {
  if (n >= 1 || n === 0) return `$${n.toFixed(2)}`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

export function tokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function useResetsIn(resetsAt: string | undefined) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  if (!resetsAt) return "";
  const ms = Math.max(0, new Date(resetsAt).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h ? `${h} hr ${m} min` : `${m} min`;
}

function Bar({ pct, className }: { pct: number; className?: string }) {
  const tone = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-foreground/80";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Daily AI usage">
      <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

/**
 * Daily spend meter, modeled on Claude's usage limits: a quiet bar with
 * "% used" and the reset time, with details on demand.
 */
export function UsageMeter() {
  const { data, isError } = useAiUsage();
  const resetsIn = useResetsIn(data?.resetsAt);
  if (isError) return null;
  const pct = data ? (data.spentUsd / data.limitUsd) * 100 : 0;
  const resetLocal = data ? new Date(data.resetsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group grid w-full gap-1 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/60"
          aria-label={data ? `Daily AI usage: ${Math.round(pct)}% used, resets in ${resetsIn}` : "Daily AI usage"}
        >
          <span className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">
              {data ? (
                <>
                  <span className={cn("font-medium text-foreground", pct >= 100 && "text-destructive")}>{Math.min(100, Math.round(pct))}% used</span> of today&apos;s {usd(data.limitUsd)}
                </>
              ) : (
                "Loading usage…"
              )}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              {data ? `Resets in ${resetsIn}` : null}
              <ChevronDownIcon className="size-3 opacity-60 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
            </span>
          </span>
          <Bar pct={pct} />
        </button>
      </PopoverTrigger>
      {data ? (
        <PopoverContent align="start" className="w-[min(92vw,340px)] p-0">
          <div className="grid gap-3 p-4">
            <div>
              <p className="text-[13px] font-medium">Daily usage limit</p>
              <p className="text-xs text-muted-foreground">{usd(data.limitUsd)} per day across all models</p>
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">Today</span>
                <span className={cn("font-medium", pct >= 100 && "text-destructive")}>{Math.min(100, Math.round(pct))}% used</span>
              </div>
              <Bar pct={pct} className="h-2" />
              <p className="text-[11px] text-muted-foreground">
                Resets in {resetsIn} ({resetLocal})
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-2 rounded-md border border-border p-2.5">
              {[
                ["Spent", usd(data.spentUsd)],
                ["Remaining", usd(data.remainingUsd)],
                ["Limit", usd(data.limitUsd)],
              ].map(([k, v]) => (
                <div key={k} className="grid gap-0.5">
                  <dt className="text-[10.5px] text-muted-foreground">{k}</dt>
                  <dd className="font-mono text-[13px] tabular">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-muted-foreground">
              {data.requests} request{data.requests === 1 ? "" : "s"} · {tokens(data.promptTokens)} input tokens · {tokens(data.completionTokens)} output tokens
            </p>
          </div>
          {data.byModel.length ? (
            <div className="border-t border-border p-4 pt-3">
              <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">By model</p>
              <ul className="grid gap-2">
                {data.byModel.map((m) => (
                  <li key={m.model} className="grid gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-mono text-[11px]">{m.model}</span>
                      <span className="shrink-0 font-mono text-[11px] tabular">{usd(m.costUsd)}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-foreground/40" style={{ width: `${data.spentUsd ? (m.costUsd / data.spentUsd) * 100 : 0}%` }} />
                    </div>
                    <p className="text-[10.5px] text-muted-foreground">
                      {m.requests} request{m.requests === 1 ? "" : "s"} · {tokens(m.promptTokens)} in · {tokens(m.completionTokens)} out
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.estimated ? (
            <p className="flex gap-1.5 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
              <InfoIcon className="mt-px size-3 shrink-0" aria-hidden /> Some costs were estimated from OpenRouter list prices.
            </p>
          ) : null}
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
