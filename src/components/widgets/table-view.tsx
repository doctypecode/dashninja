"use client";

import * as React from "react";
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { CellValue, TableWidget } from "@/lib/model/types";
import { queryChart } from "@/lib/data/query";
import { formatBucket, formatCell, formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useWidgetData } from "./use-widget-data";
import { BrokenBindingState, NeedsConfigState, NoDataState, NoRowsState } from "./empty-states";

interface Col {
  key: string;
  label: string;
  numeric: boolean;
  render: (v: CellValue) => string;
}

export function TableView({ widget }: { widget: TableWidget }) {
  const state = useWidgetData(widget);
  const [sort, setSort] = React.useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = React.useState(0);
  const b = widget.binding;

  const model = React.useMemo(() => {
    if (state.kind !== "ready") return null;
    if (b.dimension) {
      const dimCol = state.table.columns.find((c) => c.name === b.dimension);
      const res = queryChart(state.table, state.rows, { ...b, series: null }, 1);
      const cols: Col[] = [
        {
          key: "__dim",
          label: b.dimension,
          numeric: false,
          render: (v) => (dimCol?.type === "date" ? formatBucket(String(v), b.dateGrain, widget.dateFormat.style) : String(v ?? "")),
        },
        ...res.series.map((s, i) => {
          const m = b.measures[i];
          const isCount = m?.agg === "count" || m?.agg === "count_distinct";
          return {
            key: s.key,
            label: s.label,
            numeric: true,
            render: (v: CellValue) => formatValue(v as number | null, isCount || /units|qty|count/i.test(m?.field ?? "") ? { ...widget.format, kind: "number", decimals: 0 } : widget.format),
          };
        }),
      ];
      return { cols, rows: res.data };
    }
    const cols: Col[] = b.columns
      .map((name) => state.table.columns.find((c) => c.name === name))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({
        key: c.name,
        label: c.name,
        numeric: c.type === "number",
        render: (v: CellValue) => formatCell(v, c.type, undefined, widget.dateFormat.style),
      }));
    return { cols, rows: state.rows };
  }, [state, b, widget.format, widget.dateFormat.style]);

  const sorted = React.useMemo(() => {
    if (!model) return [];
    if (!sort) return model.rows;
    return [...model.rows].sort((a, z) => {
      const x = a[sort.key];
      const y = z[sort.key];
      if (typeof x === "number" && typeof y === "number") return (x - y) * sort.dir;
      return String(x ?? "").localeCompare(String(y ?? "")) * sort.dir;
    });
  }, [model, sort]);

  if (state.kind === "no-data") return <NoDataState />;
  if (state.kind === "broken") return <BrokenBindingState issues={state.issues} widgetId={widget.id} />;
  if (state.kind === "needs-config") return <NeedsConfigState message={state.message} />;
  if (!model) return null;
  if (sorted.length === 0) return <NoRowsState />;

  const size = Math.max(1, widget.options.pageSize);
  const pages = Math.ceil(sorted.length / size);
  const current = Math.min(page, pages - 1);
  const slice = sorted.slice(current * size, current * size + size);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs tabular">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {model.cols.map((c) => (
                <th key={c.key} scope="col" className={cn("h-7 border-b border-border px-2 font-medium text-muted-foreground", c.numeric ? "text-right" : "text-left")}>
                  <button
                    type="button"
                    className={cn("inline-flex items-center gap-1 rounded-sm hover:text-foreground", c.numeric && "flex-row-reverse")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSort((s) => (s?.key === c.key ? (s.dir === -1 ? { key: c.key, dir: 1 } : null) : { key: c.key, dir: -1 }));
                    }}
                    aria-label={`Sort by ${c.label}`}
                  >
                    <span className="truncate">{c.label}</span>
                    {sort?.key === c.key ? sort.dir === 1 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" /> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i} className={cn("border-b border-border last:border-0", widget.options.striped && i % 2 === 1 && "bg-muted/50")}>
                {model.cols.map((c) => (
                  <td key={c.key} className={cn("h-7 max-w-48 truncate px-2", c.numeric ? "text-right font-mono text-[11.5px]" : "text-left")}>
                    {c.render(r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="flex items-center justify-end gap-1 pt-1.5 text-[11px] text-muted-foreground">
          <span className="mr-1 tabular">
            {current * size + 1}–{Math.min(sorted.length, (current + 1) * size)} of {sorted.length}
          </span>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-muted disabled:opacity-40"
            disabled={current === 0}
            onClick={(e) => (e.stopPropagation(), setPage(current - 1))}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="size-3.5" />
          </button>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-muted disabled:opacity-40"
            disabled={current >= pages - 1}
            onClick={(e) => (e.stopPropagation(), setPage(current + 1))}
            aria-label="Next page"
          >
            <ChevronRightIcon className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
