"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  FlaskConicalIcon,
  Loader2Icon,
  PlugZapIcon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
  WifiOffIcon,
} from "lucide-react";
import type { CsvConfig, DataSource, ExcelConfig, GoogleSheetsConfig } from "@/lib/model/types";
import { ConnectorError, csvConnector, extractTable, inspectWorkbook, SOURCE_KIND_LABELS } from "@/lib/connectors";
import { useBuilder } from "@/lib/builder/store";
import { removeSource, replaceSourceTable, updateSource, widgetsUsingDataset } from "@/lib/builder/data-actions";
import { formatBytes, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Row, SimpleSelect } from "../design/inspector-fields";
import { DemoConnectorNote, useGoogleConnection } from "./import-flows";
import { SourceIcon } from "./source-icon";

export function StatusBadge({ status }: { status: DataSource["status"] }) {
  switch (status) {
    case "ready":
      return (
        <Badge variant="success">
          <CheckCircle2Icon /> Ready
        </Badge>
      );
    case "importing":
    case "refreshing":
      return (
        <Badge variant="info">
          <Loader2Icon className="animate-spin" /> {status === "importing" ? "Importing" : "Refreshing"}
        </Badge>
      );
    case "needs-auth":
      return (
        <Badge variant="warning">
          <PlugZapIcon /> Reconnect needed
        </Badge>
      );
    case "disconnected":
      return (
        <Badge variant="outline">
          <WifiOffIcon /> Disconnected
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive">
          <AlertTriangleIcon /> Error
        </Badge>
      );
  }
}

function Stat({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-[13px] tabular" : "text-[13px]"}>{value}</dd>
    </div>
  );
}

export function SourceDetails({ source, onRemoved }: { source: DataSource; onRemoved: () => void }) {
  const b = useBuilder();
  const google = useGoogleConnection();
  const [busy, setBusy] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const cache = b.importCache.current.get(source.id);
  const affectedDatasets = b.draft.datasets.filter((d) => d.sourceId === source.id);
  const affectedWidgets = affectedDatasets.flatMap((d) => widgetsUsingDataset(b.draft, d.id));

  const setStatus = (patch: Partial<DataSource>) => b.update((d) => updateSource(d, source.id, patch), { skipHistory: true });

  async function refreshSheets(config: GoogleSheetsConfig) {
    setBusy(true);
    setStatus({ status: "refreshing" });
    try {
      const res = await google.connector.fetchRange(config.spreadsheetId!, config.worksheet!, config.range);
      b.update((d) => replaceSourceTable(d, source.id, res.table, { warnings: res.warnings.length ? res.warnings : undefined }));
      toast.success(`Refreshed ${source.name}`, { description: `${res.table.rows.length.toLocaleString()} rows` });
    } catch (e) {
      const err = e instanceof ConnectorError ? e : new ConnectorError("unknown", "Refresh failed");
      setStatus({
        status: err.code === "auth_expired" ? "needs-auth" : err.code === "not_connected" ? "disconnected" : "error",
        error: { code: err.code, message: err.message, detail: err.detail },
      });
    } finally {
      setBusy(false);
    }
  }

  async function reimport(file: File) {
    setBusy(true);
    setStatus({ status: "importing" });
    try {
      if (source.config.kind === "csv") {
        const cfg = source.config;
        const text = await file.text();
        const res = await csvConnector.parse(text, { delimiter: cfg.delimiter, hasHeader: "auto" });
        b.importCache.current.set(source.id, { kind: "csv", text });
        b.update((d) =>
          replaceSourceTable(d, source.id, res.table, {
            config: { ...cfg, fileName: file.name, fileSize: file.size, hasHeader: res.hasHeader },
            warnings: res.warnings.length ? res.warnings : undefined,
          }),
        );
      } else if (source.config.kind === "excel") {
        const cfg = source.config;
        const wb = await inspectWorkbook(file);
        b.importCache.current.set(source.id, { kind: "excel", sheets: wb.sheets.map((s) => ({ name: s.name, matrix: s.matrix })) });
        const sheet = wb.sheets.find((s) => s.name === cfg.sheet) ?? wb.sheets[0];
        const res = extractTable(sheet.matrix, cfg.headerRow, cfg.range);
        b.update((d) =>
          replaceSourceTable(d, source.id, res.table, {
            config: { ...cfg, fileName: file.name, fileSize: file.size, sheet: sheet.name },
            warnings: res.warnings.length ? res.warnings : undefined,
          }),
        );
        if (sheet.name !== cfg.sheet) toast.warning(`Worksheet “${cfg.sheet}” not found — imported “${sheet.name}”.`);
      }
      toast.success(`Replaced ${source.name}`);
    } catch (e) {
      const err = e instanceof ConnectorError ? e : new ConnectorError("parse_failed", e instanceof Error ? e.message : "Import failed");
      setStatus({ status: "error", error: { code: err.code, message: err.message, detail: err.detail } });
    } finally {
      setBusy(false);
    }
  }

  function applyCsv(patch: Partial<CsvConfig>) {
    if (source.config.kind !== "csv" || cache?.kind !== "csv" || !cache.text) return;
    const cfg = { ...source.config, ...patch };
    csvConnector.parse(cache.text, { delimiter: cfg.delimiter, hasHeader: cfg.hasHeader }).then((res) =>
      b.update((d) => replaceSourceTable(d, source.id, res.table, { config: cfg, warnings: res.warnings.length ? res.warnings : undefined })),
    );
  }

  function applyExcel(patch: Partial<ExcelConfig>) {
    if (source.config.kind !== "excel" || cache?.kind !== "excel" || !cache.sheets) return;
    const cfg = { ...source.config, ...patch };
    const sheet = cache.sheets.find((s) => s.name === cfg.sheet);
    if (!sheet) return;
    try {
      const res = extractTable(sheet.matrix, cfg.headerRow, cfg.range);
      b.update((d) => replaceSourceTable(d, source.id, res.table, { config: cfg, warnings: res.warnings.length ? res.warnings : undefined }), { coalesceKey: `xl:${source.id}` });
    } catch (e) {
      const err = e instanceof ConnectorError ? e : null;
      b.update((d) => updateSource(d, source.id, { config: cfg, status: "error", error: { code: err?.code ?? "bad_config", message: err?.message ?? "Invalid settings", detail: err?.detail } }), { coalesceKey: `xl:${source.id}` });
    }
  }

  const c = source.config;
  const isFile = c.kind === "csv" || c.kind === "excel";

  return (
    <section aria-labelledby="source-title" className="rounded-xl border border-border bg-surface shadow-surface">
      <div className="flex flex-wrap items-start gap-3 border-b border-border p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
          <SourceIcon kind={source.kind} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="source-title"
              aria-label="Source name"
              value={source.name}
              onChange={(e) => b.update((d) => updateSource(d, source.id, { name: e.target.value }), { coalesceKey: `srcname:${source.id}` })}
              className="h-7 w-auto min-w-0 max-w-sm border-transparent bg-transparent px-1 text-sm font-medium shadow-none hover:border-border focus-visible:bg-surface"
            />
            <StatusBadge status={source.status} />
            {source.kind === "sample" ? <Badge variant="info">Sample data</Badge> : null}
          </div>
          <p className="mt-0.5 px-1 text-xs text-muted-foreground">
            {SOURCE_KIND_LABELS[source.kind]}
            {c.kind === "csv" || c.kind === "excel" ? ` · ${c.fileName} · ${formatBytes(c.fileSize)}` : ""}
            {c.kind === "google-sheets" ? ` · ${c.spreadsheetName} › ${c.worksheet}${c.range ? ` › ${c.range}` : ""}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {c.kind === "google-sheets" ? (
            source.status === "needs-auth" || source.status === "disconnected" ? (
              <Button
                size="sm"
                disabled={busy || google.connect.isPending}
                onClick={() =>
                  google.connect.mutate(undefined, {
                    onSuccess: () => refreshSheets(c),
                  })
                }
              >
                {google.connect.isPending ? <Loader2Icon className="animate-spin" /> : <PlugZapIcon />} Reconnect
              </Button>
            ) : (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => refreshSheets(c)}>
                <RefreshCwIcon className={busy ? "animate-spin" : undefined} /> Refresh
              </Button>
            )
          ) : isFile ? (
            <>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Replace file
              </Button>
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                accept={c.kind === "csv" ? csvConnector.accept : ".xlsx"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) reimport(f);
                  e.target.value = "";
                }}
                aria-label="Replace file"
              />
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => toast("Sample data is static", { description: "It’s generated deterministically, so refreshing returns the same rows." })}>
              <RefreshCwIcon /> Refresh
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="More source actions">
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {c.kind === "google-sheets" ? (
                <>
                  <DropdownMenuItem
                    onSelect={() => {
                      google.connector.simulateExpiry?.();
                      setStatus({ status: "needs-auth", error: { code: "auth_expired", message: "Google authorization expired", detail: "Simulated from the demo menu." } });
                    }}
                  >
                    <FlaskConicalIcon /> Simulate expired authorization
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmRemove(true)}>
                <Trash2Icon /> Remove source
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 border-b border-border p-4 sm:grid-cols-4">
        <Stat label="Rows" value={source.rowCount.toLocaleString()} />
        <Stat label="Columns" value={source.columnCount} />
        <Stat label="Last successful refresh" value={relativeTime(source.lastRefreshedAt)} mono={false} />
        <Stat label="Datasets" value={affectedDatasets.length} />
      </dl>

      {source.error && source.status !== "ready" ? (
        <div role="alert" className="m-4 rounded-md border border-destructive/30 bg-destructive-muted p-3 text-[13px]">
          <p className="flex items-center gap-1.5 font-medium text-destructive">
            <AlertTriangleIcon className="size-4" aria-hidden /> {source.error.message}
          </p>
          {source.error.detail ? <p className="mt-1 text-xs text-foreground/80">{source.error.detail}</p> : null}
          <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">code: {source.error.code} · widgets keep showing the last successful import</p>
        </div>
      ) : null}

      {source.warnings?.length ? (
        <details className="mx-4 mt-4 rounded-md border border-warning/30 bg-warning-muted px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-warning">
            {source.warnings.length} import warning{source.warnings.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-1 list-disc pl-5 text-foreground/80">
            {source.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Import / connection settings */}
      {c.kind !== "sample" ? (
        <div className="grid gap-3 p-4">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.kind === "google-sheets" ? "Connection" : "Import settings"}</h3>
          {c.kind === "csv" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Row label="Delimiter">
                <SimpleSelect
                  value={c.delimiter}
                  disabled={cache?.kind !== "csv"}
                  onChange={(delimiter) => applyCsv({ delimiter })}
                  options={[
                    { value: "auto", label: "Detect" },
                    { value: ",", label: "Comma" },
                    { value: ";", label: "Semicolon" },
                    { value: "\t", label: "Tab" },
                    { value: "|", label: "Pipe" },
                  ]}
                />
              </Row>
              <Row label="Header row">
                <div className="flex h-8 items-center gap-2 text-[13px]">
                  <Switch checked={c.hasHeader} disabled={cache?.kind !== "csv"} onCheckedChange={(hasHeader) => applyCsv({ hasHeader })} aria-label="First row is a header" />
                  First row is a header
                </div>
              </Row>
              {cache?.kind !== "csv" ? <p className="self-end text-[11px] text-muted-foreground sm:col-span-3">Replace the file to change parse settings — the original file isn’t kept after reload.</p> : null}
            </div>
          ) : c.kind === "excel" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Row label="Worksheet">
                <SimpleSelect
                  value={c.sheet}
                  disabled={cache?.kind !== "excel"}
                  onChange={(sheet) => applyExcel({ sheet })}
                  options={(cache?.sheets ?? [{ name: c.sheet }]).map((s) => ({ value: s.name, label: s.name }))}
                />
              </Row>
              <Row label="Header row">
                <Input type="number" min={1} className="h-8 tabular" value={c.headerRow} disabled={cache?.kind !== "excel"} onChange={(e) => applyExcel({ headerRow: Math.max(1, Number(e.target.value) || 1) })} />
              </Row>
              <Row label="Range">
                <Input className="h-8 font-mono text-xs uppercase" placeholder="Whole sheet" value={c.range} disabled={cache?.kind !== "excel"} onChange={(e) => applyExcel({ range: e.target.value })} />
              </Row>
              {cache?.kind !== "excel" ? <p className="text-[11px] text-muted-foreground sm:col-span-3">Replace the file to change worksheet or range — the workbook isn’t kept after reload.</p> : null}
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Row label="Account">
                  <p className="flex h-8 items-center gap-1.5 text-[13px]">
                    <span className={`size-2 rounded-full ${google.state.status === "connected" ? "bg-success" : google.state.status === "expired" ? "bg-warning" : "bg-muted-foreground"}`} aria-hidden />
                    {c.accountEmail}
                    <span className="sr-only">({google.state.status})</span>
                  </p>
                </Row>
                <Row label="Range">
                  <p className="flex h-8 items-center font-mono text-xs">{c.range || "Whole worksheet"}</p>
                </Row>
                <Row label="Refresh">
                  <SimpleSelect
                    value={c.refresh}
                    onChange={(refresh) => b.update((d) => updateSource(d, source.id, { config: { ...c, refresh } }))}
                    options={[
                      { value: "manual", label: "Manually" },
                      { value: "hourly", label: "Every hour" },
                      { value: "daily", label: "Daily" },
                    ]}
                  />
                </Row>
              </div>
              <DemoConnectorNote />
            </div>
          )}
        </div>
      ) : null}

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{source.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {affectedDatasets.length} dataset{affectedDatasets.length === 1 ? "" : "s"} built from this source will be removed.
              {affectedWidgets.length > 0
                ? ` ${affectedWidgets.length} widget${affectedWidgets.length === 1 ? "" : "s"} will keep their layout but show a binding that needs repair.`
                : ""}{" "}
              You can undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                b.update((d) => removeSource(d, source.id));
                b.importCache.current.delete(source.id);
                onRemoved();
              }}
            >
              Remove source
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
