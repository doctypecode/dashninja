"use client";

import { AlertCircleIcon, CheckIcon, CircleDotIcon, Loader2Icon, RotateCwIcon } from "lucide-react";
import type { SaveStatus } from "@/lib/builder/store";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function SaveStatusIndicator({ status, error, onRetry }: { status: SaveStatus; error: string | null; onRetry: () => void }) {
  return (
    <div aria-live="polite" className="flex shrink-0 items-center text-xs">
      {status === "saving" ? (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" aria-hidden /> <span className="hidden md:inline">Saving…</span>
          <span className="sr-only md:hidden">Saving</span>
        </span>
      ) : status === "failed" ? (
        <Hint label={error ?? "Save failed"}>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium text-destructive hover:bg-destructive-muted"
          >
            <AlertCircleIcon className="size-3.5" aria-hidden />
            <span className="hidden md:inline">Save failed</span>
            <span className="inline-flex items-center gap-1 underline underline-offset-2">
              <RotateCwIcon className="size-3" aria-hidden /> Retry
            </span>
          </button>
        </Hint>
      ) : status === "unsaved" ? (
        <span className="inline-flex items-center gap-1.5 text-warning">
          <CircleDotIcon className="size-3.5" aria-hidden /> <span className={cn("hidden md:inline")}>Unsaved changes</span>
          <span className="sr-only md:hidden">Unsaved changes</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CheckIcon className="size-3.5 text-success" aria-hidden /> <span className="hidden md:inline">Saved</span>
          <span className="sr-only md:hidden">Saved</span>
        </span>
      )}
    </div>
  );
}
