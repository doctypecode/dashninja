"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import type { ColumnSchema, Dataset } from "@/lib/model/types";
import type { StepResult } from "@/lib/data/transform";
import { Button } from "@/components/ui/button";
import { Pipeline } from "./pipeline";

/** Right-panel view of a dataset's transformation steps. */
export function TransformationsPanel({
  dataset,
  results,
  sourceColumns,
  outputColumns,
  onClose,
}: {
  dataset: Dataset;
  results: StepResult[];
  sourceColumns: ColumnSchema[];
  outputColumns: ColumnSchema[];
  onClose: () => void;
}) {
  const errors = results.filter((r) => r.status === "error").length;
  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-medium">Transformations</h2>
          <p className="truncate text-[11px] text-muted-foreground">
            {dataset.name} · {dataset.steps.length} step{dataset.steps.length === 1 ? "" : "s"}, top to bottom
            {errors ? <span className="text-destructive"> · {errors} skipped</span> : null}
          </p>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close transformations">
          <XIcon />
        </Button>
      </div>
      <div className="p-3">
        <Pipeline dataset={dataset} results={results} sourceColumns={sourceColumns} outputColumns={outputColumns} hideTitle />
      </div>
    </div>
  );
}
