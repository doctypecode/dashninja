"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangleIcon, CopyIcon, DatabaseIcon, InfoIcon, PlusIcon, Trash2Icon, WorkflowIcon, WrenchIcon } from "lucide-react";
import type { Dataset } from "@/lib/model/types";
import { useBuilder } from "@/lib/builder/store";
import { addDataset, removeDataset, updateDataset, widgetsUsingDataset } from "@/lib/builder/data-actions";
import { resolveDataset } from "@/lib/data/resolve";
import { getSourceTable } from "@/lib/connectors";
import { useRuntime } from "@/components/widgets/runtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uid, cn } from "@/lib/utils";
import { WIDGET_LABELS } from "@/lib/model/defaults";
import { AddSourceDialog } from "./add-source-dialog";
import { SourceDetails, StatusBadge } from "./source-details";
import { SourceIcon } from "./source-icon";
import { TransformationsPanel } from "./transformations-panel";
import { SOURCE_KIND_LABELS } from "@/lib/connectors";
import { relativeTime } from "@/lib/format";
import { useMediaQuery } from "@/lib/use-media-query";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { RightPanel } from "../design/design-tab";
import { DataPreview } from "./data-preview";

type Kind = "csv" | "excel" | "google-sheets" | "sample";

export function DataTab({
  onRepair,
  onFocusDataset,
  panel,
  onPanelChange,
}: {
  onRepair: (widgetId: string) => void;
  onFocusDataset?: (id: string | null) => void;
  panel: RightPanel;
  onPanelChange: (p: RightPanel) => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const b = useBuilder();
  const { issues } = useRuntime();
  const sources = b.draft.sources;
  const [sourceId, setSourceId] = React.useState<string | null>(sources[0]?.id ?? null);
  const [datasetId, setDatasetId] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<{ open: boolean; kind: Kind | null }>({ open: false, kind: null });

  const source = sources.find((s) => s.id === sourceId) ?? sources[0] ?? null;
  const datasets = b.draft.datasets.filter((d) => d.sourceId === source?.id);
  const dataset = datasets.find((d) => d.id === datasetId) ?? datasets[0] ?? null;
  const focusedId = dataset?.id ?? null;
  const result = dataset ? resolveDataset(b.draft, dataset) : null;
  const sourceTable = source ? getSourceTable(b.draft, source) : null;
  const panelContent =
    panel === "transformations" && dataset && result && sourceTable ? (
      <TransformationsPanel
        key={dataset.id}
        dataset={dataset}
        results={result.steps}
        sourceColumns={sourceTable.columns}
        outputColumns={result.table.columns}
        onClose={() => onPanelChange(null)}
      />
    ) : panel === "source" && source ? (
      <SourceDetails key={source.id} source={source} onRemoved={() => setSourceId(null)} onClose={() => onPanelChange(null)} />
    ) : null;
  React.useEffect(() => onFocusDataset?.(focusedId), [focusedId, onFocusDataset]);

  // Tell the user when a data change breaks a binding, with a one-click undo.
  const prevIssueKeys = React.useRef<Set<string>>(new Set(issues.map((i) => `${i.widgetId}:${i.role}:${i.field}`)));
  React.useEffect(() => {
    const keys = new Set(issues.map((i) => `${i.widgetId}:${i.role}:${i.field}`));
    const fresh = issues.filter((i) => !prevIssueKeys.current.has(`${i.widgetId}:${i.role}:${i.field}`));
    prevIssueKeys.current = keys;
    if (fresh.length) {
      const widgets = [...new Set(fresh.map((i) => i.widgetTitle))];
      toast.warning(`This change breaks ${widgets.length} widget binding${widgets.length > 1 ? "s" : ""}`, {
        description: widgets.slice(0, 3).join(", "),
        action: { label: "Undo", onClick: () => b.undo() },
      });
    }
  }, [issues, b]);

  const openDialog = (kind: Kind | null = null) => setDialog({ open: true, kind });
  const byWidget = React.useMemo(() => {
    const m = new Map<string, typeof issues>();
    for (const i of issues) m.set(i.widgetId, [...(m.get(i.widgetId) ?? []), i]);
    return [...m.values()];
  }, [issues]);

  return (
    <div className="flex min-h-0 flex-1">
    <div className="min-w-0 flex-1 overflow-y-auto">
    <div className="grid w-full gap-4 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight">Data</h1>
          <p className="text-xs text-muted-foreground">Where each dataset comes from and how it is prepared. Design decides how widgets use it.</p>
        </div>
        <Button size="sm" onClick={() => openDialog()}>
          <PlusIcon /> Add source
        </Button>
      </div>

      {byWidget.length > 0 ? (
        <section role="alert" aria-label="Broken widget bindings" className="rounded-xl border border-warning/40 bg-warning-muted p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-warning">
            <AlertTriangleIcon className="size-4" aria-hidden />
            {byWidget.length} widget{byWidget.length > 1 ? "s" : ""} reference data that no longer exists
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">DashNinja won’t substitute another field. Repair each binding in Design, or undo the data change.</p>
          <ul className="mt-3 grid gap-1.5">
            {byWidget.map((list) => {
              const w = b.draft.widgets.find((x) => x.id === list[0].widgetId);
              return (
                <li key={list[0].widgetId} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs">
                  <span className="font-medium">{list[0].widgetTitle}</span>
                  <span className="text-muted-foreground">{w ? WIDGET_LABELS[w.type] : ""}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{list.map((i) => i.message).join(" ")}</span>
                  <Button size="xs" variant="secondary" onClick={() => onRepair(list[0].widgetId)}>
                    <WrenchIcon /> Repair in Design
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button size="xs" variant="ghost" className="mt-2" onClick={b.undo} disabled={!b.canUndo}>
            Undo last change
          </Button>
        </section>
      ) : null}

      {sources.length === 0 ? (
        <EmptySources onPick={openDialog} />
      ) : (
        <>
          {/* Source selector */}
          <div role="radiogroup" aria-label="Sources" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {sources.map((s) => {
              const active = s.id === source?.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setSourceId(s.id);
                    setDatasetId(null);
                  }}
                  className={cn(
                    "flex min-w-44 shrink-0 items-center gap-2 rounded-md border bg-surface px-2.5 py-1.5 text-left transition-[border-color,box-shadow] duration-150",
                    active ? "border-primary ring-1 ring-primary" : "border-border hover:border-border-strong",
                  )}
                >
                  <SourceIcon kind={s.kind} className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{s.name}</span>
                    <span className="block font-mono text-[10.5px] text-muted-foreground">
                      {s.rowCount.toLocaleString()} rows · {s.columnCount} cols
                    </span>
                  </span>
                  {s.status !== "ready" ? <StatusBadge status={s.status} /> : null}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => openDialog()}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-dashed border-border-strong px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PlusIcon className="size-4" /> Add source
            </button>
          </div>

          {source ? <SourceSummary source={source} active={panel === "source"} onOpen={() => onPanelChange(panel === "source" && isDesktop ? null : "source")} /> : null}

          {/* Datasets */}
          {source ? (
            <section aria-labelledby="datasets-heading" className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="datasets-heading" className="mr-1 text-xs font-medium text-muted-foreground">
                  Datasets
                </h2>
                <div role="tablist" aria-label="Datasets" className="flex flex-wrap gap-1">
                  {datasets.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      role="tab"
                      aria-selected={d.id === dataset?.id}
                      onClick={() => setDatasetId(d.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        d.id === dataset?.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:border-border-strong",
                      )}
                    >
                      <DatabaseIcon className="size-3" /> {d.name}
                    </button>
                  ))}
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    const id = uid("ds");
                    b.update((d) => addDataset(d, source.id, id).next);
                    setDatasetId(id);
                  }}
                >
                  <PlusIcon /> New dataset
                </Button>
              </div>
              {dataset ? (
                <DatasetPanel
                  key={dataset.id}
                  dataset={dataset}
                  onDuplicated={setDatasetId}
                  onDeleted={() => setDatasetId(null)}
                  transformationsOpen={panel === "transformations"}
                  onOpenTransformations={() => onPanelChange(panel === "transformations" && isDesktop ? null : "transformations")}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border-strong p-8 text-center text-sm text-muted-foreground">
                  No datasets use this source yet. Create one to make its data available in Design.
                </div>
              )}
            </section>
          ) : null}
        </>
      )}

      <AddSourceDialog
        open={dialog.open}
        initialKind={dialog.kind}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onAdded={(sid, did) => {
          setSourceId(sid);
          setDatasetId(did);
          toast.success("Source added", { description: "Its dataset is now available to widgets in Design." });
        }}
      />
    </div>
    </div>

    {isDesktop && panelContent ? (
      <aside
        aria-label={panel === "source" ? "Source details" : "Transformations"}
        className="w-[360px] shrink-0 overflow-y-auto border-l border-border bg-surface animate-in slide-in-from-right-2 fade-in-0 duration-200 xl:w-[380px]"
      >
        {panelContent}
      </aside>
    ) : null}
    {!isDesktop ? (
      <Sheet open={Boolean(panelContent)} onOpenChange={(o) => !o && onPanelChange(null)}>
        <SheetContent side="right" className="w-[min(100vw,400px)] p-0 [&>button:last-child]:hidden">
          <SheetTitle className="sr-only">{panel === "source" ? "Source details" : "Transformations"}</SheetTitle>
          <SheetDescription className="sr-only">Data tab panel</SheetDescription>
          <div className="min-h-0 flex-1 overflow-y-auto">{panelContent}</div>
        </SheetContent>
      </Sheet>
    ) : null}
    </div>
  );
}

function SourceSummary({ source, active, onOpen }: { source: import("@/lib/model/types").DataSource; active: boolean; onOpen: () => void }) {
  const c = source.config;
  const detail =
    c.kind === "csv" || c.kind === "excel" ? c.fileName : c.kind === "google-sheets" ? [c.spreadsheetName, c.worksheet].filter(Boolean).join(" › ") : "Sample";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs">
      <SourceIcon kind={source.kind} className="size-3.5 text-muted-foreground" />
      <span className="font-medium">{source.name}</span>
      <StatusBadge status={source.status} />
      <span className="text-muted-foreground">
        {SOURCE_KIND_LABELS[source.kind]}
        {detail && detail !== source.name && detail !== SOURCE_KIND_LABELS[source.kind] ? ` · ${detail}` : ""}
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {source.rowCount.toLocaleString("en-US")} rows · {source.columnCount} cols
      </span>
      <span className="text-muted-foreground">Refreshed {relativeTime(source.lastRefreshedAt)}</span>
      {source.error && source.status !== "ready" ? <span className="text-destructive">{source.error.message}</span> : null}
      <Button size="xs" variant={active ? "secondary" : "ghost"} className="ml-auto" onClick={onOpen} aria-pressed={active}>
        <InfoIcon /> Source details
      </Button>
    </div>
  );
}

function DatasetPanel({
  dataset,
  onDuplicated,
  onDeleted,
  transformationsOpen,
  onOpenTransformations,
}: {
  dataset: Dataset;
  onDuplicated: (id: string) => void;
  onDeleted: () => void;
  transformationsOpen: boolean;
  onOpenTransformations: () => void;
}) {
  const b = useBuilder();
  const result = resolveDataset(b.draft, dataset);
  const usedBy = widgetsUsingDataset(b.draft, dataset.id);
  const [name, setName] = React.useState(dataset.name);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follow undo/redo
    setName(dataset.name);
  }, [dataset.name]);
  const nameTaken = b.draft.datasets.some((d) => d.id !== dataset.id && d.name === name.trim());

  if (!result) return null;
  const errors = result.steps.filter((s) => s.status === "error").length;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="grid gap-1">
          <Input
            aria-label="Dataset name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const n = name.trim();
              if (!n || nameTaken) setName(dataset.name);
              else if (n !== dataset.name) b.update((d) => updateDataset(d, dataset.id, { name: n }));
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-invalid={nameTaken || undefined}
            className="h-8 w-64 text-sm font-medium"
          />
          {nameTaken ? <p className="text-[11px] text-destructive">Another dataset already uses this name.</p> : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {usedBy.length ? `Used by ${usedBy.length} widget${usedBy.length > 1 ? "s" : ""}` : "Not used by any widget yet"}
        </span>
        {errors ? (
          <span className="inline-flex items-center gap-1 text-xs text-destructive">
            <AlertTriangleIcon className="size-3.5" aria-hidden /> {errors} step{errors > 1 ? "s" : ""} skipped
          </span>
        ) : null}
        <Button size="xs" variant={transformationsOpen ? "secondary" : "outline"} onClick={onOpenTransformations} aria-pressed={transformationsOpen}>
          <WorkflowIcon /> {dataset.steps.length} transformation{dataset.steps.length === 1 ? "" : "s"}
        </Button>
        <div className="ml-auto flex gap-1">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              const id = uid("ds");
              b.update((d) => addDataset(d, dataset.sourceId, id, dataset).next);
              onDuplicated(id);
            }}
          >
            <CopyIcon /> Duplicate
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="text-destructive hover:bg-destructive-muted"
            onClick={() => {
              b.update((d) => removeDataset(d, dataset.id));
              onDeleted();
              if (usedBy.length) toast.warning(`Deleted “${dataset.name}”`, { description: `${usedBy.length} widget binding(s) now need repair.`, action: { label: "Undo", onClick: () => b.undo() } });
            }}
          >
            <Trash2Icon /> Delete
          </Button>
        </div>
      </div>
      <DataPreview table={result.table} />
    </div>
  );
}

function EmptySources({ onPick }: { onPick: (k: Kind) => void }) {
  const options: { kind: Kind; title: string; body: string }[] = [
    { kind: "csv", title: "Upload a CSV", body: "Header and delimiter detection" },
    { kind: "excel", title: "Upload an Excel workbook", body: "Choose worksheet and range" },
    { kind: "google-sheets", title: "Connect Google Sheets", body: "Pick a spreadsheet to sync" },
    { kind: "sample", title: "Use sample data", body: "Synthetic sales orders" },
  ];
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface p-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots mask-fade-radial opacity-60" />
      <div className="relative mx-auto max-w-2xl text-center">
        <h2 className="text-base font-medium">Connect your first source</h2>
        <p className="mt-1 text-sm text-muted-foreground">Imported data becomes a named dataset that widgets in Design can bind to.</p>
        <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
          {options.map((o) => (
            <button
              key={o.kind}
              type="button"
              onClick={() => onPick(o.kind)}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-border-strong hover:bg-muted/50"
            >
              <span className="flex size-8 items-center justify-center rounded-md border border-border bg-surface">
                <SourceIcon kind={o.kind} className="size-4" />
              </span>
              <span>
                <span className="block text-[13px] font-medium">{o.title}</span>
                <span className="block text-xs text-muted-foreground">{o.body}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
