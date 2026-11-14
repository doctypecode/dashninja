import Papa from "papaparse";
import type { CellValue } from "@/lib/model/types";
import { buildTypedTable, looksLikeHeader, normaliseHeaders } from "@/lib/data/schema";
import { ConnectorError, type CsvParseOptions, type CsvParseResult, type FileConnector } from "./types";

const MAX_ROWS = 20000;
const DELIMS = [",", ";", "\t", "|"] as const;

function detectDelimiter(text: string): (typeof DELIMS)[number] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  let best: (typeof DELIMS)[number] = ",";
  let bestScore = -1;
  for (const d of DELIMS) {
    const counts = lines.map((l) => l.split(d).length - 1);
    if (counts.length === 0 || counts[0] === 0) continue;
    const consistent = counts.filter((c) => c === counts[0]).length / counts.length;
    const score = counts[0] * consistent;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

async function readText(input: File | string | ArrayBuffer): Promise<string> {
  if (typeof input === "string") return input;
  if (input instanceof ArrayBuffer) return new TextDecoder().decode(input);
  return input.text();
}

export const csvConnector: FileConnector<CsvParseOptions, CsvParseResult> = {
  kind: "csv",
  accept: ".csv,.tsv,.txt,text/csv",
  maxBytes: 10 * 1024 * 1024,
  async parse(input, options) {
    if (typeof File !== "undefined" && input instanceof File && input.size > this.maxBytes) {
      throw new ConnectorError("file_too_large", "File is larger than 10 MB", "The demo parses files in your browser. Split the file or use Google Sheets.");
    }
    const text = (await readText(input)).replace(/^﻿/, "");
    if (!text.trim()) throw new ConnectorError("empty_file", "The file is empty");
    const detectedDelimiter = detectDelimiter(text);
    const delimiter = options.delimiter === "auto" ? detectedDelimiter : options.delimiter;
    const parsed = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: "greedy" });
    const matrix = parsed.data as CellValue[][];
    if (matrix.length === 0) throw new ConnectorError("no_rows", "No rows found");

    const detectedHeader = looksLikeHeader(matrix[0], matrix.slice(1));
    const hasHeader = options.hasHeader === "auto" ? detectedHeader : options.hasHeader;
    const width = Math.max(...matrix.slice(0, 200).map((r) => r.length));
    const headerRow = hasHeader ? matrix[0] : Array.from({ length: width }, (_, i) => `column_${i + 1}`);
    const { headers, warnings } = normaliseHeaders(headerRow);

    const issues: { row: number; message: string }[] = [];
    let body = matrix.slice(hasHeader ? 1 : 0);
    if (body.length > MAX_ROWS) {
      warnings.push(`Only the first ${MAX_ROWS.toLocaleString()} rows were imported.`);
      body = body.slice(0, MAX_ROWS);
    }
    body = body.map((r, i) => {
      if (r.length !== headers.length) {
        if (issues.length < 50)
          issues.push({
            row: i + (hasHeader ? 2 : 1),
            message: `Expected ${headers.length} values, found ${r.length}${r.length > headers.length ? " (extra values dropped)" : " (padded with empty)"}`,
          });
        return headers.map((_, j) => r[j] ?? null);
      }
      return r;
    });
    if (issues.length) warnings.push(`${issues.length}${issues.length === 50 ? "+" : ""} rows had a different number of values than the header.`);
    for (const e of parsed.errors.slice(0, 5)) {
      if (e.type !== "FieldMismatch") warnings.push(`Parser: ${e.message}${e.row !== undefined ? ` (row ${e.row + 1})` : ""}`);
    }

    return {
      table: buildTypedTable(headers, body),
      warnings,
      issues,
      detectedDelimiter,
      detectedHeader,
      hasHeader,
    };
  },
};
