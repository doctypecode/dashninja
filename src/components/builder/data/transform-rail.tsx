"use client";

import * as React from "react";
import { AlertCircleIcon, DatabaseIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PlusIcon, TableIcon } from "lucide-react";
import type { ColumnSchema, Dataset, TransformStep } from "@/lib/model/types";
import type { StepResult } from "@/lib/data/transform";
import { describeStep, STEP_LABELS } from "@/lib/data/transform";
import { useBuilder } from "@/lib/builder/store";
import { updateSteps } from "@/lib/builder/data-actions";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn, uid } from "@/lib/utils";
import { Hint } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pipeline, STEP_ICONS, STEP_ORDER } from "./pipeline";
import { defaultStep } from "./step-editor";

const DRAWER_KEY = "dn:transform-drawer";

function readDrawerPref() {
  try {
    return window.localStorage.getItem(DRAWER_KEY) !== "closed";
  } catch {
    return true;
  }
}

/**
 * Transformations live in a slim left rail (one icon per step) plus a drawer
 * with the full pipeline editor. The preview always gets the remaining width,
 * so the two never overlap. On desktop the drawer docks beside the preview;
 * below 1024px it slides over as a sheet.
 */
export function TransformWorkspace({
  dataset,
  results,
  sourceColumns,
  outputColumns,
  children,
}: {
  dataset: Dataset;
  results: StepResult[];
  sourceColumns: ColumnSchema[];
  outputColumns: ColumnSchema[];
  children: React.ReactNode;
}) {
  const b = useBuilder();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [open, setOpenState] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Restore the docked drawer preference on desktop after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser preference once
    if (isDesktop) setOpenState(readDrawerPref());
  }, [isDesktop]);

  const setOpen = (next: boolean) => {
    setOpenState(next);
    if (isDesktop) {
      try {
        window.localStorage.setItem(DRAWER_KEY, next ? "open" : "closed");
      } catch {
        /* ignore */
      }
    }
  };

  const focusStep = (id: string | null) => {
    setEditing(id);
    setOpen(true);
  };

  const add = (type: TransformStep["type"]) => {
    const step = defaultStep(type, outputColumns, uid("st"));
    b.update((d) => updateSteps(d, dataset.id, (s) => [...s, step]));
    focusStep(step.id);
  };

  const errors = results.filter((r) => r.status === "error").length;

  const pipeline = (
    <Pipeline
      dataset={dataset}
      results={results}
      sourceColumns={sourceColumns}
      outputColumns={outputColumns}
      editing={editing}
      onEditingChange={setEditing}
      hideTitle
    />
  );

  const header = (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">Transformations</p>
        <p className="text-[11px] text-muted-foreground">
          {dataset.steps.length} step{dataset.steps.length === 1 ? "" : "s"} · applied top to bottom
          {errors ? <span className="text-destructive"> · {errors} skipped</span> : null}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-w-0 overflow-hidden rounded-lg border border-border bg-background">
      {/* Rail */}
      <nav aria-label="Transformation steps" className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-2">
        <Hint label={open ? "Hide transformations" : "Show transformations"} side="right">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="transform-drawer"
            className={cn(
              "relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              open && "bg-muted text-foreground",
            )}
          >
            {open ? <PanelLeftCloseIcon className="size-4" /> : <PanelLeftOpenIcon className="size-4" />}
            <span className="sr-only">Transformations</span>
          </button>
        </Hint>
        <span className="my-1 h-px w-6 bg-border" aria-hidden />
        <Hint label={`Source · ${sourceColumns.length} columns`} side="right">
          <span className="flex size-8 items-center justify-center rounded-md text-muted-foreground" aria-label="Source">
            <DatabaseIcon className="size-3.5" />
          </span>
        </Hint>
        <ol className="flex min-h-0 flex-col items-center gap-1 overflow-y-auto">
          {dataset.steps.map((step, i) => {
            const Icon = STEP_ICONS[step.type];
            const r = results.find((x) => x.stepId === step.id);
            const active = open && editing === step.id;
            return (
              <li key={step.id}>
                <Hint label={`${i + 1}. ${STEP_LABELS[step.type]}: ${describeStep(step)}${step.enabled ? "" : " (disabled)"}${r?.status === "error" ? ` (skipped: ${r.message})` : ""}`} side="right">
                  <button
                    type="button"
                    onClick={() => (active ? setEditing(null) : focusStep(step.id))}
                    aria-label={`Step ${i + 1}: ${STEP_LABELS[step.type]}`}
                    aria-pressed={active}
                    className={cn(
                      "relative flex size-8 items-center justify-center rounded-md border transition-colors",
                      active ? "border-border-strong bg-muted text-foreground" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                      !step.enabled && "opacity-45",
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-sm bg-surface px-0.5 font-mono text-[8px] leading-none text-muted-foreground">{i + 1}</span>
                    {r?.status === "error" ? <AlertCircleIcon className="absolute -top-1 -right-1 size-3 rounded-full bg-surface text-destructive" aria-hidden /> : null}
                  </button>
                </Hint>
              </li>
            );
          })}
        </ol>
        <DropdownMenu>
          <Hint label="Add step" side="right">
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Add transformation step"
                className="flex size-8 items-center justify-center rounded-md border border-dashed border-border-strong text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <PlusIcon className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent side="right" align="start" className="w-52">
            {STEP_ORDER.map((t) => {
              const Icon = STEP_ICONS[t];
              return (
                <DropdownMenuItem key={t} onSelect={() => add(t)}>
                  <Icon /> {STEP_LABELS[t]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="my-1 h-px w-6 bg-border" aria-hidden />
        <Hint label={`Output · ${outputColumns.length} columns`} side="right">
          <span className="flex size-8 items-center justify-center rounded-md text-muted-foreground" aria-label="Output">
            <TableIcon className="size-3.5" />
          </span>
        </Hint>
      </nav>

      {/* Docked drawer (desktop) */}
      {isDesktop && open ? (
        <aside id="transform-drawer" aria-label="Transformations" className="flex w-[360px] shrink-0 flex-col border-r border-border bg-surface animate-fade-in xl:w-[380px]">
          {header}
          <div className="max-h-[640px] min-h-0 overflow-y-auto p-3">{pipeline}</div>
        </aside>
      ) : null}

      {/* Overlay drawer (tablet / phone) */}
      {!isDesktop ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" id="transform-drawer" className="w-[min(92vw,400px)]">
            <SheetTitle className="sr-only">Transformations</SheetTitle>
            <SheetDescription className="sr-only">Edit, reorder, disable or remove steps for {dataset.name}.</SheetDescription>
            {header}
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{pipeline}</div>
          </SheetContent>
        </Sheet>
      ) : null}

      {/* Preview always takes the remaining width */}
      <div className="grid min-w-0 flex-1 content-start gap-2 bg-surface p-3">{children}</div>
    </div>
  );
}
