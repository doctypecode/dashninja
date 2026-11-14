"use client";

import * as React from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { AlertTriangleIcon, ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon } from "lucide-react";
import type { CellValue, RawTable, Row } from "@/lib/model/types";
import { cellMatchesType, isEmpty, validateTable } from "@/lib/data/schema";
import { formatCell } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TypeGlyph } from "../design/inspector-fields";

/** Dataset preview: typed headers, validation indicators, sorting and pagination. */
export function DataPreview({ table, pageSize = 25, highlight }: { table: RawTable; pageSize?: number; highlight?: Set<string> }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const validation = React.useMemo(() => validateTable(table), [table]);

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () =>
      table.columns.map((c) => ({
        id: c.name,
        accessorFn: (r: Row) => r[c.name],
        header: c.name,
        sortingFn: (a, b, id) => {
          const x = a.getValue<CellValue>(id);
          const y = b.getValue<CellValue>(id);
          if (isEmpty(x)) return 1;
          if (isEmpty(y)) return -1;
          if (typeof x === "number" && typeof y === "number") return x - y;
          return String(x).localeCompare(String(y));
        },
        meta: { type: c.type },
      })),
    [table.columns],
  );

  // TanStack Table returns non-memoizable functions by design; this component owns the instance.
  // eslint-disable-next-line react-hooks/incompatible-library
  const t = useReactTable({
    data: table.rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    autoResetPageIndex: true,
  });

  if (table.columns.length === 0) {
    return <div className="rounded-lg border border-dashed border-border-strong p-8 text-center text-sm text-muted-foreground">No columns to preview.</div>;
  }

  const { pageIndex } = t.getState().pagination;
  const total = table.rows.length;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <div className="grid min-w-0 gap-2">
      <div className="max-h-[520px] min-w-0 overflow-auto rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-xs tabular">
          <thead className="sticky top-0 z-10 bg-muted">
            {t.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                <th scope="col" className="sticky left-0 z-10 w-10 border-r border-b border-border bg-muted px-2 text-right font-mono text-[10px] font-normal text-muted-foreground">
                  #
                </th>
                {hg.headers.map((h) => {
                  const col = table.columns.find((c) => c.name === h.column.id)!;
                  const v = validation[col.name];
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                      className={cn("h-9 min-w-32 border-b border-border px-2 text-left align-middle font-normal whitespace-nowrap", highlight?.has(col.name) && "bg-info-muted")}
                    >
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={h.column.getToggleSortingHandler()} className="flex min-w-0 items-center gap-1.5 rounded-sm text-foreground hover:text-foreground">
                          <TypeGlyph type={col.type} />
                          <span className="truncate font-mono font-medium">{col.name}</span>
                          {sorted === "asc" ? <ArrowUpIcon className="size-3" /> : sorted === "desc" ? <ArrowDownIcon className="size-3" /> : <ChevronsUpDownIcon className="size-3 opacity-30" />}
                        </button>
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{col.type}</span>
                        {v.invalid > 0 ? (
                          <Hint label={`${v.invalid} value${v.invalid > 1 ? "s" : ""} can’t be read as ${col.type}`}>
                            <span className="inline-flex items-center gap-0.5 rounded-sm bg-warning-muted px-1 font-mono text-[10px] text-warning">
                              <AlertTriangleIcon className="size-3" aria-hidden /> {v.invalid}
                              <span className="sr-only">invalid values</span>
                            </span>
                          </Hint>
                        ) : null}
                        {v.empty > 0 ? (
                          <Hint label={`${v.empty} empty value${v.empty > 1 ? "s" : ""}`}>
                            <span className="rounded-sm bg-background px-1 font-mono text-[10px] text-muted-foreground">∅ {v.empty}</span>
                          </Hint>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {t.getRowModel().rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="sticky left-0 border-r border-border bg-surface px-2 text-right font-mono text-[10px] text-muted-foreground">{r.index + 1}</td>
                {r.getVisibleCells().map((cell) => {
                  const col = table.columns.find((c) => c.name === cell.column.id)!;
                  const v = cell.getValue<CellValue>();
                  const empty = isEmpty(v);
                  const invalid = !empty && !cellMatchesType(v, col.type);
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "h-8 max-w-64 truncate px-2",
                        col.type === "number" && "text-right font-mono text-[11.5px]",
                        col.type === "date" && "font-mono text-[11.5px]",
                        invalid && "bg-warning-muted text-warning",
                      )}
                      title={invalid ? `Not a valid ${col.type}` : undefined}
                    >
                      {empty ? <span className="text-muted-foreground/60">—</span> : invalid ? String(v) : formatCell(v, col.type, undefined, "iso")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {total === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No rows. Check the filters in your pipeline.</p> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular">
          {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} rows · {table.columns.length} columns
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={() => t.previousPage()} disabled={!t.getCanPreviousPage()} aria-label="Previous page">
            <ChevronLeftIcon />
          </Button>
          <span className="tabular">
            Page {pageIndex + 1} of {Math.max(1, t.getPageCount())}
          </span>
          <Button variant="ghost" size="icon-xs" onClick={() => t.nextPage()} disabled={!t.getCanNextPage()} aria-label="Next page">
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
