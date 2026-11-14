"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  LogOutIcon,
  RefreshCwIcon,
  Sheet as SheetIcon,
  UploadIcon,
} from "lucide-react";
import type { CellValue, CsvConfig, ExcelConfig, GoogleSheetsConfig, RawTable } from "@/lib/model/types";
import {
  buildSampleWorkbook,
  ConnectorError,
  csvConnector,
  extractTable,
  getGoogleSheetsConnector,
  inspectWorkbook,
  type CsvParseResult,
  type GoogleConnectionState,
  type ParsedImport,
  type WorkbookInspection,
} from "@/lib/connectors";
import { getSalesCsvText } from "@/lib/data/samples";
import { formatBytes, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Row, SimpleSelect, TypeGlyph } from "../design/inspector-fields";
import { DataPreview } from "./data-preview";

export interface ImportResult {
  name: string;
  config: CsvConfig | ExcelConfig | GoogleSheetsConfig;
  table: RawTable;
  warnings: string[];
  cache?: { kind: "csv"; text: string } | { kind: "excel"; sheets: { name: string; matrix: CellValue[][] }[] };
}

// ---------- Shared bits ----------

export function Dropzone({ accept, onFile, label, hint }: { accept: string; onFile: (f: File) => void; label: string; hint: string }) {
  const [over, setOver] = React.useState(false);
  const inputId = React.useId();
  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors duration-150 focus-within:border-focus",
        over ? "border-focus bg-info-muted" : "border-border-strong bg-background hover:bg-muted/50",
      )}
    >
      <UploadIcon className="size-5 text-muted-foreground" aria-hidden />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <input
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const e = error instanceof ConnectorError ? error : null;
  return (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive-muted px-3 py-2.5 text-[13px] text-destructive">
      <p className="flex items-center gap-1.5 font-medium">
        <AlertTriangleIcon className="size-4" aria-hidden /> {e?.message ?? (error instanceof Error ? error.message : "Something went wrong")}
      </p>
      {e?.detail ? <p className="mt-1 text-xs opacity-90">{e.detail}</p> : null}
      {e?.code ? <p className="mt-1 font-mono text-[10.5px] opacity-75">code: {e.code}</p> : null}
    </div>
  );
}

function ImportSummary({ result }: { result: ParsedImport }) {
  const { table, warnings, issues } = result;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="success">
          <CheckCircle2Icon /> Ready to import
        </Badge>
        <span className="font-mono text-muted-foreground">
          {table.rows.length.toLocaleString()} rows · {table.columns.length} columns
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {table.columns.map((c) => (
          <span key={c.name} className="inline-flex items-center gap-1 rounded-[4px] border border-border bg-background px-1.5 py-0.5 font-mono text-[10.5px]">
            <TypeGlyph type={c.type} /> {c.name}
            <span className="text-muted-foreground">{c.type}</span>
          </span>
        ))}
      </div>
      {warnings.length ? (
        <div className="rounded-md border border-warning/30 bg-warning-muted px-3 py-2 text-xs text-warning" role="status">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangleIcon className="size-3.5" aria-hidden /> {warnings.length} import warning{warnings.length > 1 ? "s" : ""}
          </p>
          <ul className="mt-1 list-disc pl-5 text-foreground/80">
            {warnings.slice(0, 5).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {issues.length ? (
            <details className="mt-1 text-foreground/80">
              <summary className="cursor-pointer">Row details</summary>
              <ul className="mt-1 max-h-24 overflow-auto font-mono text-[10.5px]">
                {issues.slice(0, 20).map((i) => (
                  <li key={i.row}>
                    row {i.row}: {i.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
      <DataPreview table={{ columns: table.columns, rows: table.rows.slice(0, 50) }} pageSize={6} />
    </div>
  );
}

// ---------- CSV ----------

export function CsvImport({ onReady }: { onReady: (r: ImportResult | null) => void }) {
  const [file, setFile] = React.useState<{ name: string; size: number; text: string } | null>(null);
  const [delimiter, setDelimiter] = React.useState<CsvConfig["delimiter"]>("auto");
  const [header, setHeader] = React.useState<"auto" | boolean>("auto");
  const parse = useMutation({
    mutationFn: (v: { text: string | File; delimiter: CsvConfig["delimiter"]; header: "auto" | boolean }) =>
      csvConnector.parse(v.text, { delimiter: v.delimiter, hasHeader: v.header }),
  });
  const result: CsvParseResult | undefined = parse.data;

  const run = (text: string, d = delimiter, h = header) => parse.mutate({ text, delimiter: d, header: h });

  React.useEffect(() => {
    if (!file || !result) return onReady(null);
    onReady({
      name: file.name,
      config: { kind: "csv", fileName: file.name, fileSize: file.size, delimiter, hasHeader: result.hasHeader },
      table: result.table,
      warnings: result.warnings,
      cache: { kind: "csv", text: file.text },
    });
  }, [file, result, delimiter, onReady]);

  async function load(f: File) {
    if (f.size > csvConnector.maxBytes) {
      setFile(null);
      parse.mutate({ text: f, delimiter, header });
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, size: f.size, text });
    setHeader("auto");
    run(text, delimiter, "auto");
  }

  if (!file) {
    return (
      <div className="grid gap-3">
        <Dropzone accept={csvConnector.accept} onFile={load} label="Drop a CSV file or browse" hint="Comma, semicolon, tab or pipe delimited · up to 10 MB · parsed in your browser" />
        {parse.isError ? <ErrorBox error={parse.error} /> : null}
        <Button
          variant="link"
          size="sm"
          className="justify-self-center"
          onClick={() => {
            const text = getSalesCsvText(400);
            setFile({ name: "sample_sales.csv", size: text.length, text });
            run(text, "auto", "auto");
          }}
        >
          <FileTextIcon /> Use the sample CSV (synthetic sales data)
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
        <FileTextIcon className="size-4 text-muted-foreground" aria-hidden />
        <span className="truncate font-medium">{file.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{formatBytes(file.size)}</span>
        <Button variant="ghost" size="xs" className="ml-auto" onClick={() => (setFile(null), parse.reset())}>
          Choose another
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Row label="Delimiter" hint={result ? `Detected: ${labelDelim(result.detectedDelimiter)}` : undefined}>
          <SimpleSelect
            value={delimiter}
            onChange={(d) => {
              setDelimiter(d);
              run(file.text, d, header);
            }}
            options={[
              { value: "auto", label: "Detect automatically" },
              { value: ",", label: "Comma ( , )" },
              { value: ";", label: "Semicolon ( ; )" },
              { value: "\t", label: "Tab" },
              { value: "|", label: "Pipe ( | )" },
            ]}
          />
        </Row>
        <Row label="Header row" hint={result ? `Detected: ${result.detectedHeader ? "first row is a header" : "no header row"}` : undefined}>
          <div className="flex h-8 items-center gap-2">
            <Switch
              checked={result?.hasHeader ?? true}
              onCheckedChange={(on) => {
                setHeader(on);
                run(file.text, delimiter, on);
              }}
              aria-label="First row contains column names"
            />
            <span className="text-[13px]">First row contains column names</span>
          </div>
        </Row>
      </div>
      {parse.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2Icon className="size-4 animate-spin" /> Parsing…
        </p>
      ) : parse.isError ? (
        <ErrorBox error={parse.error} />
      ) : result ? (
        <ImportSummary result={result} />
      ) : null}
    </div>
  );
}

function labelDelim(d: string) {
  return d === "\t" ? "tab" : d === "," ? "comma" : d === ";" ? "semicolon" : "pipe";
}

// ---------- Excel ----------

export function ExcelImport({ onReady }: { onReady: (r: ImportResult | null) => void }) {
  const [file, setFile] = React.useState<{ name: string; size: number } | null>(null);
  const [sheet, setSheet] = React.useState<string | null>(null);
  const [headerRow, setHeaderRow] = React.useState(1);
  const [range, setRange] = React.useState("");
  const inspect = useMutation({ mutationFn: (input: File | ArrayBuffer) => inspectWorkbook(input) });
  const wb: WorkbookInspection | undefined = inspect.data;

  const extracted = React.useMemo(() => {
    if (!wb || !sheet) return null;
    const s = wb.sheets.find((x) => x.name === sheet);
    if (!s) return null;
    try {
      return { ok: true as const, result: extractTable(s.matrix, headerRow, range) };
    } catch (e) {
      return { ok: false as const, error: e };
    }
  }, [wb, sheet, headerRow, range]);

  React.useEffect(() => {
    if (!file || !wb || !sheet || !extracted?.ok) return onReady(null);
    onReady({
      name: file.name,
      config: { kind: "excel", fileName: file.name, fileSize: file.size, sheet, headerRow, range },
      table: extracted.result.table,
      warnings: extracted.result.warnings,
      cache: { kind: "excel", sheets: wb.sheets.map((s) => ({ name: s.name, matrix: s.matrix })) },
    });
  }, [file, wb, sheet, headerRow, range, extracted, onReady]);

  const onInspected = (res: WorkbookInspection) => {
    const first = res.sheets[0];
    setSheet(first.name);
    // Guess the header row: first row with at least two non-empty text cells.
    const guess = first.matrix.findIndex((r) => r.filter((v) => typeof v === "string" && v.trim()).length >= 2);
    setHeaderRow(guess >= 0 ? guess + 1 : 1);
    setRange("");
  };

  if (!file) {
    return (
      <div className="grid gap-3">
        <Dropzone
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onFile={(f) => {
            setFile({ name: f.name, size: f.size });
            inspect.mutate(f, { onSuccess: onInspected });
          }}
          label="Drop an Excel workbook or browse"
          hint=".xlsx workbooks · parsed in your browser"
        />
        <Button
          variant="link"
          size="sm"
          className="justify-self-center"
          onClick={async () => {
            const buf = await buildSampleWorkbook();
            setFile({ name: "sample_workbook.xlsx", size: buf.byteLength });
            inspect.mutate(buf, { onSuccess: onInspected });
          }}
        >
          <FileSpreadsheetIcon /> Use the sample workbook (2 worksheets)
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
        <FileSpreadsheetIcon className="size-4 text-muted-foreground" aria-hidden />
        <span className="truncate font-medium">{file.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{formatBytes(file.size)}</span>
        <Button variant="ghost" size="xs" className="ml-auto" onClick={() => (setFile(null), inspect.reset(), setSheet(null))}>
          Choose another
        </Button>
      </div>
      {inspect.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2Icon className="size-4 animate-spin" /> Inspecting workbook…
        </p>
      ) : inspect.isError ? (
        <ErrorBox error={inspect.error} />
      ) : wb ? (
        <>
          <Row label="Worksheet">
            <div role="radiogroup" aria-label="Worksheet" className="grid gap-1.5 sm:grid-cols-2">
              {wb.sheets.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  role="radio"
                  aria-checked={sheet === s.name}
                  onClick={() => {
                    setSheet(s.name);
                    const guess = s.matrix.findIndex((r) => r.filter((v) => typeof v === "string" && v.trim()).length >= 2);
                    setHeaderRow(guess >= 0 ? guess + 1 : 1);
                    setRange("");
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    sheet === s.name ? "border-primary ring-1 ring-primary" : "border-border hover:border-border-strong",
                  )}
                >
                  <SheetIcon className="size-4 text-muted-foreground" aria-hidden />
                  <span className="flex-1 truncate font-medium">{s.name}</span>
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {s.rowCount}×{s.columnCount}
                  </span>
                </button>
              ))}
            </div>
          </Row>
          <div className="grid gap-3 sm:grid-cols-2">
            <Row label="Header row" htmlFor="xl-header" hint="Row number of the column names (within the range, if set).">
              <Input id="xl-header" type="number" min={1} className="h-8 w-24 tabular" value={headerRow} onChange={(e) => setHeaderRow(Math.max(1, Number(e.target.value) || 1))} />
            </Row>
            <Row label="Range (optional)" htmlFor="xl-range" hint="A1 notation, e.g. A3:I400. Empty uses the whole sheet.">
              <Input id="xl-range" className="h-8 font-mono text-xs uppercase" value={range} onChange={(e) => setRange(e.target.value)} placeholder="A1:F200" />
            </Row>
          </div>
          {extracted && !extracted.ok ? <ErrorBox error={extracted.error} /> : extracted?.ok ? <ImportSummary result={extracted.result} /> : null}
        </>
      ) : null}
    </div>
  );
}

// ---------- Google Sheets (demo connector) ----------

export function useGoogleConnection() {
  const connector = getGoogleSheetsConnector();
  const [state, setState] = React.useState<GoogleConnectionState>({ status: "disconnected" });
  React.useEffect(() => {
    const read = () => setState(connector.getConnection());
    read();
    window.addEventListener("dashninja:google-demo", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("dashninja:google-demo", read);
      window.removeEventListener("storage", read);
    };
  }, [connector]);
  const connect = useMutation({ mutationFn: () => connector.connect() });
  const disconnect = useMutation({ mutationFn: () => connector.disconnect() });
  return { connector, state: connect.isPending ? ({ status: "connecting" } as const) : state, connect, disconnect };
}

export function GoogleSheetsImport({ onReady }: { onReady: (r: ImportResult | null) => void }) {
  const { connector, state, connect, disconnect } = useGoogleConnection();
  const connected = state.status === "connected";
  const list = useQuery({ queryKey: ["google-demo", "spreadsheets"], queryFn: () => connector.listSpreadsheets(), enabled: connected, retry: false });
  const [spreadsheetId, setSpreadsheetId] = React.useState<string | null>(null);
  const [worksheet, setWorksheet] = React.useState<string | null>(null);
  const [range, setRange] = React.useState("");
  const [refresh, setRefresh] = React.useState<GoogleSheetsConfig["refresh"]>("manual");
  const fetchRange = useMutation({ mutationFn: (v: { id: string; ws: string; range: string }) => connector.fetchRange(v.id, v.ws, v.range) });
  const spreadsheet = list.data?.find((s) => s.id === spreadsheetId);

  React.useEffect(() => {
    if (!connected || !spreadsheet || !worksheet || !fetchRange.data || state.status !== "connected") return onReady(null);
    onReady({
      name: `${spreadsheet.name} · ${worksheet}`,
      config: {
        kind: "google-sheets",
        accountEmail: state.account.email,
        spreadsheetId: spreadsheet.id,
        spreadsheetName: spreadsheet.name,
        worksheet,
        range,
        refresh,
      },
      table: fetchRange.data.table,
      warnings: fetchRange.data.warnings,
    });
  }, [connected, spreadsheet, worksheet, range, refresh, fetchRange.data, state, onReady]);

  if (state.status === "disconnected" || state.status === "connecting") {
    return (
      <div className="grid gap-4">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-background px-6 py-8 text-center">
          <SheetIcon className="size-6 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-medium">Connect a Google account</p>
            <p className="mt-1 text-xs text-muted-foreground">DashNinja asks for read-only access to spreadsheets you choose.</p>
          </div>
          <Button onClick={() => connect.mutate()} disabled={state.status === "connecting"}>
            {state.status === "connecting" ? <Loader2Icon className="animate-spin" /> : null}
            {state.status === "connecting" ? "Waiting for Google…" : "Connect Google account"}
          </Button>
        </div>
        <DemoConnectorNote />
      </div>
    );
  }

  if (state.status === "expired") {
    return (
      <div className="grid gap-3">
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-muted p-4 text-sm">
          <AlertTriangleIcon className="mt-0.5 size-4 text-warning" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Authorization expired for {state.account.email}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Reconnect to list spreadsheets and refresh connected sources.</p>
          </div>
          <Button size="sm" onClick={() => connect.mutate()}>
            Reconnect
          </Button>
        </div>
        <DemoConnectorNote />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
        <span className="size-2 rounded-full bg-success" aria-hidden />
        <span className="truncate">
          Connected as <span className="font-medium">{state.account.email}</span>
        </span>
        <Badge variant="outline" className="font-mono">
          demo
        </Badge>
        <Button variant="ghost" size="xs" className="ml-auto" onClick={() => disconnect.mutate()}>
          <LogOutIcon /> Disconnect
        </Button>
      </div>

      <Row label="Spreadsheet">
        {list.isPending ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" /> Loading spreadsheets…
          </p>
        ) : list.isError ? (
          <div className="grid gap-2">
            <ErrorBox error={list.error} />
            <Button size="xs" variant="secondary" className="justify-self-start" onClick={() => list.refetch()}>
              <RefreshCwIcon /> Retry
            </Button>
          </div>
        ) : (
          <div role="radiogroup" aria-label="Spreadsheet" className="grid gap-1.5">
            {list.data.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={spreadsheetId === s.id}
                onClick={() => {
                  setSpreadsheetId(s.id);
                  setWorksheet(s.worksheets[0]?.name ?? null);
                  fetchRange.reset();
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  spreadsheetId === s.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-border-strong",
                )}
              >
                <SheetIcon className="size-4 text-success" aria-hidden />
                <span className="flex-1 truncate font-medium">{s.name}</span>
                <span className="text-[11px] text-muted-foreground">edited {relativeTime(s.modifiedAt)}</span>
              </button>
            ))}
          </div>
        )}
      </Row>

      {spreadsheet ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Row label="Worksheet">
              <SimpleSelect value={worksheet ?? ""} onChange={(v) => (setWorksheet(v), fetchRange.reset())} options={spreadsheet.worksheets.map((w) => ({ value: w.name, label: w.name }))} />
            </Row>
            <Row label="Range (optional)" htmlFor="gs-range">
              <Input id="gs-range" className="h-8 font-mono text-xs uppercase" value={range} onChange={(e) => (setRange(e.target.value), fetchRange.reset())} placeholder="A1:D90" />
            </Row>
            <Row label="Refresh">
              <SimpleSelect value={refresh} onChange={setRefresh} options={[{ value: "manual", label: "Manually" }, { value: "hourly", label: "Every hour" }, { value: "daily", label: "Daily" }]} />
            </Row>
          </div>
          {refresh !== "manual" ? (
            <p className="-mt-2 text-[11px] text-muted-foreground">Scheduled refresh is saved with the source; running it on a schedule requires the server integration.</p>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            className="justify-self-start"
            disabled={!worksheet || fetchRange.isPending}
            onClick={() => worksheet && fetchRange.mutate({ id: spreadsheet.id, ws: worksheet, range })}
          >
            {fetchRange.isPending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
            {fetchRange.data ? "Reload preview" : "Load preview"}
          </Button>
          {fetchRange.isError ? <ErrorBox error={fetchRange.error} /> : fetchRange.data ? <ImportSummary result={fetchRange.data} /> : null}
        </>
      ) : null}
      <DemoConnectorNote />
    </div>
  );
}

export function DemoConnectorNote() {
  return (
    <p className="rounded-md border border-dashed border-border-strong bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      <span className="mr-1.5 rounded-[4px] border border-border bg-surface px-1 py-px font-mono text-[10px] uppercase text-foreground">Demo</span>
      This connector is simulated: nothing is sent to Google and the spreadsheets contain synthetic data. Replace{" "}
      <span className="font-mono">getGoogleSheetsConnector()</span> to go live.
    </p>
  );
}
