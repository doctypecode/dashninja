import type { CellValue, ColumnSchema, ColumnType, RawTable, Row } from "@/lib/model/types";

const NUMBER_RE = /^[-+]?(\$|€|£)?\s?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?%?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?)?$/;
const US_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function isEmpty(v: CellValue | undefined): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

export function parseNumber(v: CellValue): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null) return null;
  const s = v.trim();
  if (!NUMBER_RE.test(s)) return null;
  const n = Number(s.replace(/[$€£,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Normalises supported date inputs to ISO yyyy-mm-dd. */
export function parseDate(v: CellValue): string | null {
  if (v === null || typeof v === "boolean") return null;
  if (typeof v === "number") {
    // Excel serial date (days since 1899-12-30) within a sane range.
    if (v > 20000 && v < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return d.toISOString().slice(0, 10);
    }
    return null;
  }
  const s = v.trim();
  if (ISO_DATE_RE.test(s)) {
    const d = new Date(s.length === 10 ? `${s}T00:00:00Z` : s);
    return Number.isNaN(d.getTime()) ? null : s.slice(0, 10);
  }
  const us = US_DATE_RE.exec(s);
  if (us) {
    const [, mm, dd, yyyy] = us;
    const m = Number(mm);
    const d = Number(dd);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
}

export function parseBoolean(v: CellValue): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === null) return null;
  const s = String(v).trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(s)) return true;
  if (["false", "no", "n", "0"].includes(s)) return false;
  return null;
}

export function inferColumnType(values: CellValue[]): ColumnType {
  const sample = values.filter((v) => !isEmpty(v)).slice(0, 500);
  if (sample.length === 0) return "string";
  const ratio = (fn: (v: CellValue) => unknown) => sample.filter((v) => fn(v) !== null).length / sample.length;
  if (sample.every((v) => typeof v === "boolean") || ratio(parseBooleanStrict) === 1) return "boolean";
  if (ratio(parseNumber) >= 0.98) return "number";
  if (ratio(parseDate) >= 0.98 && sample.some((v) => typeof v === "string")) return "date";
  return "string";
}

function parseBooleanStrict(v: CellValue) {
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return ["true", "false", "yes", "no"].includes(s) ? s : null;
}

/** Coerce a cell into the declared type. Returns `undefined` when it cannot be coerced (a validation issue). */
export function coerce(v: CellValue, type: ColumnType): CellValue | undefined {
  if (isEmpty(v)) return null;
  switch (type) {
    case "number": {
      const n = parseNumber(v);
      return n === null ? undefined : n;
    }
    case "date": {
      const d = parseDate(v);
      return d === null ? undefined : d;
    }
    case "boolean": {
      const b = parseBoolean(v);
      return b === null ? undefined : b;
    }
    default:
      return typeof v === "string" ? v : String(v);
  }
}

/** Build a typed table from raw string-ish records, inferring a type per column. */
export function buildTypedTable(headers: string[], records: CellValue[][]): RawTable {
  const columns: ColumnSchema[] = headers.map((name, i) => ({
    name,
    type: inferColumnType(records.map((r) => r[i] ?? null)),
  }));
  const rows: Row[] = records.map((rec) => {
    const row: Row = {};
    columns.forEach((c, i) => {
      const raw = rec[i] ?? null;
      const value = coerce(raw, c.type);
      // Keep the raw value when it can't be coerced so validation can flag it.
      row[c.name] = value === undefined ? (raw as CellValue) : value;
    });
    return row;
  });
  return { columns, rows };
}

/** Clean header names: trim, fill blanks, de-duplicate. Returns warnings for changes. */
export function normaliseHeaders(raw: CellValue[]): { headers: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const seen = new Map<string, number>();
  const headers = raw.map((h, i) => {
    let name = h === null || h === undefined ? "" : String(h).trim();
    if (!name) {
      name = `column_${i + 1}`;
      warnings.push(`Column ${i + 1} had no header and was named “${name}”.`);
    }
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) {
      const renamed = `${name}_${count + 1}`;
      warnings.push(`Duplicate header “${name}” renamed to “${renamed}”.`);
      name = renamed;
    }
    return name;
  });
  return { headers, warnings };
}

/** Heuristic header detection: first row is text-only while later rows contain numbers or dates. */
export function looksLikeHeader(first: CellValue[], rest: CellValue[][]): boolean {
  if (first.length === 0) return false;
  const firstAllText = first.every((v) => !isEmpty(v) && parseNumber(v) === null && parseDate(v) === null);
  if (!firstAllText) return false;
  if (rest.length === 0) return true;
  const sample = rest.slice(0, 20);
  const typedCells = sample.flat().filter((v) => parseNumber(v) !== null || parseDate(v) !== null).length;
  const uniqueFirst = new Set(first.map(String)).size === first.length;
  return uniqueFirst && (typedCells > 0 || sample.length > 0);
}

export interface ColumnValidation {
  invalid: number;
  empty: number;
}

export function validateTable(table: RawTable): Record<string, ColumnValidation> {
  const out: Record<string, ColumnValidation> = {};
  for (const c of table.columns) out[c.name] = { invalid: 0, empty: 0 };
  for (const row of table.rows) {
    for (const c of table.columns) {
      const v = row[c.name];
      if (isEmpty(v)) out[c.name].empty++;
      else if (!cellMatchesType(v, c.type)) out[c.name].invalid++;
    }
  }
  return out;
}

export function cellMatchesType(v: CellValue, type: ColumnType): boolean {
  if (isEmpty(v)) return true;
  switch (type) {
    case "number":
      return typeof v === "number";
    case "boolean":
      return typeof v === "boolean";
    case "date":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    default:
      return true;
  }
}
