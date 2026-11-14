"use client";

import * as React from "react";
import { ArrowLeftIcon, DatabaseIcon, FileSpreadsheetIcon, FileTextIcon, Sheet as SheetIcon } from "lucide-react";
import type { SampleConfig } from "@/lib/model/types";
import { getSalesSample, getTargetsSample } from "@/lib/data/samples";
import { useBuilder } from "@/lib/builder/store";
import { addSource, newIds } from "@/lib/builder/data-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Row } from "../design/inspector-fields";
import { CsvImport, ExcelImport, GoogleSheetsImport, type ImportResult } from "./import-flows";

type Kind = "csv" | "excel" | "google-sheets" | "sample";

const KINDS: { kind: Kind; title: string; body: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: "csv", title: "CSV file", body: "Upload .csv or .tsv", icon: FileTextIcon },
  { kind: "excel", title: "Excel workbook", body: "Upload .xlsx, pick a sheet", icon: FileSpreadsheetIcon },
  { kind: "google-sheets", title: "Google Sheets", body: "Connect an account", icon: SheetIcon },
  { kind: "sample", title: "Sample data", body: "Synthetic sales & targets", icon: DatabaseIcon },
];

export function AddSourceDialog({
  open,
  onOpenChange,
  onAdded,
  initialKind,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdded: (sourceId: string, datasetId: string) => void;
  initialKind?: Kind | null;
}) {
  const b = useBuilder();
  const [kind, setKind] = React.useState<Kind | null>(initialKind ?? null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [name, setName] = React.useState("");
  const [sample, setSample] = React.useState<SampleConfig["sampleId"]>("sales");

  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the wizard each time it opens
      setKind(initialKind ?? null);
      setResult(null);
      setName("");
    }
  }, [open, initialKind]);

  const onReady = React.useCallback((r: ImportResult | null) => {
    setResult(r);
    if (r) setName((n) => n || r.name);
  }, []);

  const importNow = () => {
    const ids = newIds();
    if (kind === "sample") {
      const t = sample === "sales" ? getSalesSample() : getTargetsSample();
      b.update(
        (d) =>
          addSource(
            d,
            {
              name: sample === "sales" ? "sales_orders.csv (sample)" : "Regional targets (sample)",
              config: { kind: "sample", sampleId: sample },
              table: t,
              datasetName: sample === "sales" ? "Sales" : "Targets",
            },
            ids,
          ).next,
      );
    } else if (result) {
      b.update((d) => addSource(d, { name: name.trim() || result.name, config: result.config, table: result.table, warnings: result.warnings }, ids).next);
      if (result.cache) b.importCache.current.set(ids.sourceId, result.cache);
    } else return;
    onAdded(ids.sourceId, ids.datasetId);
    onOpenChange(false);
  };

  const canImport = kind === "sample" || Boolean(result);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            {kind && !initialKind ? (
              <Button variant="ghost" size="icon-xs" onClick={() => (setKind(null), setResult(null))} aria-label="Back to source types">
                <ArrowLeftIcon />
              </Button>
            ) : null}
            <DialogTitle>{kind ? KINDS.find((k) => k.kind === kind)!.title : "Add a data source"}</DialogTitle>
          </div>
          <DialogDescription>
            {kind === null
              ? "Each source becomes a dataset you can prepare with transformations."
              : kind === "sample"
                ? "Deterministic synthetic data, clearly labelled as sample."
                : "Check the detected structure, then import."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(70dvh,640px)] overflow-y-auto px-5 py-4">
          {kind === null ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  onClick={() => setKind(k.kind)}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-left transition-[border-color,background-color] duration-150 hover:border-border-strong hover:bg-muted/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface shadow-surface">
                    <k.icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{k.title}</span>
                    <span className="block text-xs text-muted-foreground">{k.body}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : kind === "csv" ? (
            <CsvImport onReady={onReady} />
          ) : kind === "excel" ? (
            <ExcelImport onReady={onReady} />
          ) : kind === "google-sheets" ? (
            <GoogleSheetsImport onReady={onReady} />
          ) : (
            <div role="radiogroup" aria-label="Sample dataset" className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["sales", "Sales orders", `${getSalesSample().rows.length.toLocaleString()} orders · Jan 2025 – Oct 2026`],
                  ["targets", "Regional targets", `${getTargetsSample().rows.length} monthly targets by region`],
                ] as const
              ).map(([id, title, body]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={sample === id}
                  onClick={() => setSample(id)}
                  className={cn("rounded-lg border p-4 text-left transition-colors", sample === id ? "border-primary ring-1 ring-primary" : "border-border hover:border-border-strong")}
                >
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="block text-xs text-muted-foreground">{body}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {kind ? (
          <DialogFooter className="items-center border-t border-border px-5 py-3">
            {kind !== "sample" ? (
              <div className="mr-auto w-full sm:w-72">
                <Row label="Source name" htmlFor="src-name">
                  <Input id="src-name" className="h-8 text-[13px]" value={name} onChange={(e) => setName(e.target.value)} disabled={!result} placeholder="Name shown in Data" />
                </Row>
              </div>
            ) : null}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={importNow} disabled={!canImport}>
              {kind === "google-sheets" ? "Connect source" : kind === "sample" ? "Add sample data" : "Import"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
