import type { CellValue } from "@/lib/model/types";
import { buildTypedTable, normaliseHeaders } from "@/lib/data/schema";
import { ConnectorError, type ParsedImport, type WorkbookInspection } from "./types";

/**
 * Excel connector. Parses .xlsx in the browser with exceljs (loaded on demand).
 * A production version could run the same logic in a server action or worker.
 */

const PREVIEW_ROWS = 400;

function normaliseCell(v: unknown): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return normaliseCell(o.result);
    if ("richText" in o && Array.isArray(o.richText)) return o.richText.map((t: { text: string }) => t.text).join("");
    if ("text" in o) return String(o.text);
    if ("error" in o) return null;
  }
  return String(v);
}

export async function inspectWorkbook(input: File | ArrayBuffer): Promise<WorkbookInspection> {
  const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (e) {
    throw new ConnectorError(
      "invalid_workbook",
      "This file could not be read as an Excel workbook",
      e instanceof Error ? e.message : "Only .xlsx workbooks are supported in this version (not legacy .xls).",
    );
  }
  const sheets = wb.worksheets.map((ws) => {
    const matrix: CellValue[][] = [];
    const maxRow = Math.min(ws.actualRowCount ? ws.rowCount : 0, 20000);
    for (let r = 1; r <= maxRow; r++) {
      const row = ws.getRow(r);
      const values: CellValue[] = [];
      for (let c = 1; c <= ws.columnCount; c++) values.push(normaliseCell(row.getCell(c).value));
      matrix.push(values);
    }
    while (matrix.length && matrix[matrix.length - 1].every((v) => v === null || v === "")) matrix.pop();
    return { name: ws.name, rowCount: matrix.length, columnCount: ws.columnCount, matrix };
  });
  if (sheets.length === 0) throw new ConnectorError("no_sheets", "The workbook has no worksheets");
  return { sheets };
}

export function columnLetter(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function columnIndex(letters: string): number {
  return letters.toUpperCase().split("").reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
}

/** Parse "B2:F120" into zero-based bounds. Returns null when empty; throws on bad input. */
export function parseRange(range: string): { r0: number; c0: number; r1: number; c1: number } | null {
  const s = range.trim();
  if (!s) return null;
  const m = /^([A-Za-z]{1,3})(\d+):([A-Za-z]{1,3})(\d+)$/.exec(s);
  if (!m) throw new ConnectorError("bad_range", `“${range}” is not a valid range`, "Use A1 notation such as A1:F200.");
  const c0 = columnIndex(m[1]);
  const c1 = columnIndex(m[3]);
  const r0 = Number(m[2]) - 1;
  const r1 = Number(m[4]) - 1;
  if (r1 < r0 || c1 < c0) throw new ConnectorError("bad_range", "Range end must come after its start");
  return { r0, c0, r1, c1 };
}

/** Turn a worksheet matrix into a typed table using a 1-based header row and optional range. */
export function extractTable(matrix: CellValue[][], headerRow: number, range: string): ParsedImport {
  const bounds = parseRange(range);
  let rows = matrix;
  if (bounds) rows = matrix.slice(bounds.r0, bounds.r1 + 1).map((r) => r.slice(bounds.c0, bounds.c1 + 1));
  const headerIdx = headerRow - 1 - (bounds ? 0 : 0);
  if (headerIdx < 0 || headerIdx >= rows.length) {
    throw new ConnectorError("bad_header_row", `Header row ${headerRow} is outside the selected data`);
  }
  const header = rows[headerIdx];
  const width = Math.max(header.length, ...rows.slice(headerIdx + 1, headerIdx + 50).map((r) => r.length));
  const trimmedWidth = (() => {
    let w = width;
    while (w > 0 && rows.every((r) => r[w - 1] === null || r[w - 1] === undefined || r[w - 1] === "")) w--;
    return w;
  })();
  const { headers, warnings } = normaliseHeaders(Array.from({ length: trimmedWidth }, (_, i) => header[i] ?? null));
  const body = rows
    .slice(headerIdx + 1)
    .filter((r) => r.some((v) => v !== null && v !== ""))
    .map((r) => headers.map((_, i) => r[i] ?? null));
  if (body.length === 0) warnings.push("No data rows below the header row.");
  return { table: buildTypedTable(headers, body), warnings, issues: [] };
}

/** Build a small demo workbook in the browser so the Excel flow can be tried without a file. */
export async function buildSampleWorkbook(): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const { getSalesSample, getTargetsSample } = await import("@/lib/data/samples");
  const wb = new ExcelJS.Workbook();
  const sales = getSalesSample();
  const ws = wb.addWorksheet("Orders");
  ws.addRow(["DashNinja demo workbook · synthetic data"]);
  ws.addRow([]);
  ws.addRow(sales.columns.map((c) => c.name));
  for (const r of sales.rows.slice(0, PREVIEW_ROWS)) ws.addRow(sales.columns.map((c) => r[c.name]));
  const targets = getTargetsSample();
  const ws2 = wb.addWorksheet("Targets");
  ws2.addRow(targets.columns.map((c) => c.name));
  for (const r of targets.rows) ws2.addRow(targets.columns.map((c) => r[c.name]));
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
