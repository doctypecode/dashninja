"use client";

import * as React from "react";
import {
  AlertCircleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ColumnsIcon,
  EraserIcon,
  FilterIcon,
  FunctionSquareIcon,
  GripVerticalIcon,
  GroupIcon,
  PencilIcon,
  PlusIcon,
  RepeatIcon,
  TextCursorInputIcon,
  Trash2Icon,
} from "lucide-react";
import type { ColumnSchema, Dataset, TransformStep } from "@/lib/model/types";
import type { StepResult } from "@/lib/data/transform";
import { describeStep, STEP_LABELS } from "@/lib/data/transform";
import { useBuilder } from "@/lib/builder/store";
import { updateSteps } from "@/lib/builder/data-actions";
import { uid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Hint } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { defaultStep, StepEditor } from "./step-editor";

export const STEP_ICONS: Record<TransformStep["type"], React.ComponentType<{ className?: string }>> = {
  rename: TextCursorInputIcon,
  select: ColumnsIcon,
  cast: RepeatIcon,
  filter: FilterIcon,
  fill_empty: EraserIcon,
  calculated: FunctionSquareIcon,
  group: GroupIcon,
};

export const STEP_ORDER: TransformStep["type"][] = ["rename", "select", "cast", "filter", "fill_empty", "calculated", "group"];

export function Pipeline({
  dataset,
  results,
  sourceColumns,
  outputColumns,
  editing: editingProp,
  onEditingChange,
  hideTitle,
}: {
  dataset: Dataset;
  results: StepResult[];
  sourceColumns: ColumnSchema[];
  outputColumns: ColumnSchema[];
  /** Controlled: id of the step whose editor is open. */
  editing?: string | null;
  onEditingChange?: (id: string | null) => void;
  hideTitle?: boolean;
}) {
  const b = useBuilder();
  const [editingLocal, setEditingLocal] = React.useState<string | null>(null);
  const editing = editingProp !== undefined ? editingProp : editingLocal;
  const setEditing = (id: string | null) => (onEditingChange ? onEditingChange(id) : setEditingLocal(id));
  const [dragId, setDragId] = React.useState<string | null>(null);
  const steps = dataset.steps;

  const change = (fn: (s: TransformStep[]) => TransformStep[], coalesceKey?: string) =>
    b.update((d) => updateSteps(d, dataset.id, fn), { coalesceKey: coalesceKey ? `${dataset.id}:${coalesceKey}` : undefined });

  const add = (type: TransformStep["type"]) => {
    const step = defaultStep(type, outputColumns, uid("st"));
    change((s) => [...s, step]);
    setEditing(step.id);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= steps.length || from === to) return;
    change((s) => {
      const next = [...s];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  return (
    <div className="grid content-start gap-2">
      <div className={cn("flex items-center", hideTitle ? "justify-end" : "justify-between")}>
        {hideTitle ? null : <h3 className="text-[13px] font-medium">Transformations</h3>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="xs">
              <PlusIcon /> Add step <ChevronDownIcon className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
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
      </div>

      <ol className="grid gap-1.5" aria-label="Transformation pipeline">
        <li className="flex items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground">
          <span className="font-mono text-[10px]">00</span>
          Source · {sourceColumns.length} columns
        </li>
        {steps.map((step, i) => {
          const r = results.find((x) => x.stepId === step.id);
          const Icon = STEP_ICONS[step.type];
          const open = editing === step.id;
          return (
            <li
              key={step.id}
              onDragOver={(e) => {
                if (dragId) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = steps.findIndex((s) => s.id === dragId);
                if (from >= 0) move(from, i);
                setDragId(null);
              }}
              className={cn(
                "rounded-md border bg-surface transition-[border-color,opacity] duration-150",
                r?.status === "error" ? "border-destructive/40" : open ? "border-border-strong" : "border-border",
                !step.enabled && "opacity-60",
                dragId === step.id && "opacity-40",
              )}
            >
              <div className="flex items-center gap-1.5 px-1.5 py-1.5">
                <span
                  draggable
                  onDragStart={(e) => {
                    setDragId(step.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDragId(null)}
                  className="cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted"
                  aria-hidden
                >
                  <GripVerticalIcon className="size-3.5" />
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <button type="button" onClick={() => setEditing(open ? null : step.id)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
                  <span className="block truncate text-xs font-medium">{STEP_LABELS[step.type]}</span>
                  <span className="block truncate font-mono text-[10.5px] text-muted-foreground">{describeStep(step)}</span>
                </button>
                {r?.status === "error" ? (
                  <Hint label={r.message}>
                    <AlertCircleIcon className="size-3.5 shrink-0 text-destructive" aria-label={`Step error: ${r.message}`} />
                  </Hint>
                ) : r && r.status === "ok" && r.rowsIn !== r.rowsOut ? (
                  <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground xl:inline">
                    {r.rowsIn}→{r.rowsOut}
                  </span>
                ) : null}
                <Hint label={step.enabled ? "Disable step" : "Enable step"}>
                  <span>
                    <Switch
                      checked={step.enabled}
                      onCheckedChange={(enabled) => change((s) => s.map((x) => (x.id === step.id ? { ...x, enabled } : x)))}
                      aria-label={`${step.enabled ? "Disable" : "Enable"} ${STEP_LABELS[step.type]}`}
                      className="scale-90"
                    />
                  </span>
                </Hint>
              </div>
              {r?.status === "error" ? (
                <p className="mx-2 mb-2 rounded-[4px] bg-destructive-muted px-2 py-1 text-[11px] text-destructive" role="alert">
                  Skipped: {r.message}
                </p>
              ) : null}
              {open ? (
                <div className="grid gap-3 border-t border-border p-3 animate-fade-in">
                  <StepEditor
                    step={step}
                    columns={r?.columnsIn ?? outputColumns}
                    onChange={(next, key) => change((s) => s.map((x) => (x.id === step.id ? next : x)), key ? `${step.id}:${key}` : undefined)}
                  />
                  <div className="flex items-center gap-1 border-t border-border pt-2">
                    <Button variant="ghost" size="xs" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move step up">
                      <ArrowUpIcon /> Up
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => move(i, i + 1)} disabled={i === steps.length - 1} aria-label="Move step down">
                      <ArrowDownIcon /> Down
                    </Button>
                    <Button variant="ghost" size="xs" className="ml-auto text-destructive hover:bg-destructive-muted" onClick={() => change((s) => s.filter((x) => x.id !== step.id))}>
                      <Trash2Icon /> Remove
                    </Button>
                    <Button variant="secondary" size="xs" onClick={() => setEditing(null)}>
                      Done
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
        {steps.length === 0 ? (
          <li className="rounded-md border border-dashed border-border-strong p-4 text-center text-xs text-muted-foreground">
            No steps yet. The dataset matches its source. Add a step to rename, retype, filter or calculate.
          </li>
        ) : null}
        <li className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-2 text-xs">
          <PencilIcon className="size-3 text-muted-foreground" aria-hidden />
          <span className="font-medium">Output</span>
          <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">{outputColumns.length} columns</span>
        </li>
      </ol>
    </div>
  );
}
