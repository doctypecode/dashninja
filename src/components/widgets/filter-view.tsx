"use client";

import * as React from "react";
import { CalendarIcon, ChevronDownIcon, XIcon } from "lucide-react";
import type { DateRangePreset, FilterWidget } from "@/lib/model/types";
import { defaultFilterValue, distinctValues, RANGE_LABELS } from "@/lib/data/query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRuntime } from "./runtime";
import { BrokenBindingState, NeedsConfigState, NoDataState } from "./empty-states";

export function FilterView({ widget }: { widget: FilterWidget }) {
  const { tables, filterState, setFilter, issuesByWidget } = useRuntime();
  const { datasetId, field, control } = widget.options;
  const table = datasetId ? tables.get(datasetId) : undefined;
  const issues = issuesByWidget.get(widget.id);
  const options = React.useMemo(() => (table && field && control === "select" ? distinctValues(table, field) : []), [table, field, control]);
  const value = filterState[widget.id] ?? defaultFilterValue(widget);

  if (issues?.length) return <BrokenBindingState issues={issues} widgetId={widget.id} />;
  if (!datasetId || !table) return <NoDataState compact />;
  if (!field) return <NeedsConfigState message="Choose a field to filter by." />;

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (control === "date_range") {
    return (
      <div className="flex h-full items-center" onPointerDown={stop}>
        <Select value={value.range ?? "all"} onValueChange={(v) => setFilter(widget.id, { range: v as DateRangePreset })}>
          <SelectTrigger size="sm" aria-label={widget.title || field}>
            <span className="flex items-center gap-2 truncate">
              <CalendarIcon className="size-3.5 text-muted-foreground" />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGE_LABELS) as DateRangePreset[]).map((k) => (
              <SelectItem key={k} value={k}>
                {RANGE_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const selected = value.values ?? [];
  const label =
    selected.length === 0 ? `All ${field.replace(/_/g, " ")}s` : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  return (
    <div className="flex h-full items-center gap-1" onPointerDown={stop}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-surface px-2.5 text-[13px] shadow-surface outline-none hover:border-border-strong focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/20",
            )}
            aria-label={`${widget.title || field}: ${label}`}
          >
            <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>{label}</span>
            <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1">
          <div className="max-h-64 overflow-auto">
            {options.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-[5px] px-2 py-1.5 text-[13px] hover:bg-muted">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) =>
                      setFilter(widget.id, { values: c ? [...selected, opt] : selected.filter((s) => s !== opt) })
                    }
                  />
                  <span className="truncate">{opt}</span>
                </label>
              );
            })}
          </div>
          {selected.length > 0 ? (
            <button
              type="button"
              className="mt-1 w-full rounded-[5px] border-t border-border px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setFilter(widget.id, { values: [] })}
            >
              Clear selection
            </button>
          ) : null}
        </PopoverContent>
      </Popover>
      {selected.length > 0 ? (
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setFilter(widget.id, { values: [] })}
          aria-label="Clear filter"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
