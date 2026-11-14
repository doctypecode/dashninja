"use client";

import { AlertTriangleIcon, DatabaseIcon, FilterXIcon, SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BindingIssue } from "@/lib/data/resolve";
import { useRuntime } from "./runtime";

export function NoDataState({ compact }: { compact?: boolean }) {
  const { onRequestData, mode, dashboard } = useRuntime();
  const hasDatasets = dashboard.datasets.length > 0;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <DatabaseIcon className="size-4 text-muted-foreground" aria-hidden />
      <p className="max-w-56 text-xs text-muted-foreground">
        {hasDatasets ? "Choose a dataset for this widget." : "No data connected yet."}
      </p>
      {mode === "edit" && onRequestData && !hasDatasets && !compact ? (
        <Button size="xs" variant="secondary" onClick={(e) => (e.stopPropagation(), onRequestData())}>
          Open Data
        </Button>
      ) : null}
    </div>
  );
}

export function NeedsConfigState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <SlidersHorizontalIcon className="size-4 text-muted-foreground" aria-hidden />
      <p className="max-w-56 text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

export function NoRowsState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
      <FilterXIcon className="size-4 text-muted-foreground" aria-hidden />
      <p className="text-xs text-muted-foreground">No rows match the current filters.</p>
    </div>
  );
}

export function BrokenBindingState({ issues, widgetId }: { issues: BindingIssue[]; widgetId: string }) {
  const { onRepair, mode } = useRuntime();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-2 text-center" role="alert">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning">
        <AlertTriangleIcon className="size-3.5" aria-hidden /> Binding needs repair
      </span>
      <p className="max-w-64 text-xs text-muted-foreground">{issues[0].message}</p>
      {mode === "edit" && onRepair ? (
        <Button size="xs" variant="secondary" onClick={(e) => (e.stopPropagation(), onRepair(widgetId))}>
          Repair binding
        </Button>
      ) : (
        <p className="text-[11px] text-muted-foreground">The dashboard owner needs to update this widget.</p>
      )}
    </div>
  );
}
