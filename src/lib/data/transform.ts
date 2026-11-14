import type {
  AggregateFn,
  CellValue,
  ColumnSchema,
  RawTable,
  Row,
  TransformStep,
} from "@/lib/model/types";
import { coerce, isEmpty, parseNumber } from "./schema";
import { evaluate, ExpressionError, parseExpression, referencedColumns } from "./expression";

export interface StepResult {
  stepId: string;
  status: "ok" | "skipped" | "error" | "disabled";
  message?: string;
  rowsIn: number;
  rowsOut: number;
  columnsOut: number;
  /** Schema the step received; editors offer these columns. */
  columnsIn: ColumnSchema[];
}

export interface PipelineResult {
  table: RawTable;
  steps: StepResult[];
}

export function aggregate(values: CellValue[], fn: AggregateFn): number | null {
  if (fn === "count") return values.filter((v) => !isEmpty(v)).length;
  if (fn === "count_distinct") return new Set(values.filter((v) => !isEmpty(v)).map(String)).size;
  const nums = values.map((v) => (typeof v === "number" ? v : parseNumber(v))).filter((n): n is number => n !== null);
  if (nums.length === 0) return null;
  switch (fn) {
    case "sum":
      return nums.reduce((a, b) => a + b, 0);
    case "avg":
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min":
      return Math.min(...nums);
    case "max":
      return Math.max(...nums);
  }
  return null;
}

function compare(cell: CellValue, operator: string, raw: string, type: ColumnSchema["type"]): boolean {
  if (operator === "is_empty") return isEmpty(cell);
  if (operator === "not_empty") return !isEmpty(cell);
  if (isEmpty(cell)) return false;
  if (operator === "contains") return String(cell).toLowerCase().includes(raw.toLowerCase());
  if (operator === "not_contains") return !String(cell).toLowerCase().includes(raw.toLowerCase());
  let a: number | string = String(cell);
  let b: number | string = raw;
  if (type === "number") {
    const n = parseNumber(raw);
    if (n === null) return false;
    a = Number(cell);
    b = n;
  } else if (type === "boolean") {
    a = String(cell).toLowerCase();
    b = raw.toLowerCase();
  }
  switch (operator) {
    case "eq":
      return type === "string" ? String(a).toLowerCase() === String(b).toLowerCase() : a === b;
    case "neq":
      return type === "string" ? String(a).toLowerCase() !== String(b).toLowerCase() : a !== b;
    case "gt":
      return a > b;
    case "gte":
      return a >= b;
    case "lt":
      return a < b;
    case "lte":
      return a <= b;
  }
  return true;
}

/** Columns a step reads; used for validation and to explain breakages. */
export function stepInputs(step: TransformStep): string[] {
  switch (step.type) {
    case "rename":
    case "cast":
    case "filter":
    case "fill_empty":
      return [step.column];
    case "select":
      return step.columns;
    case "calculated":
      try {
        return [...referencedColumns(parseExpression(step.expression))];
      } catch {
        return [];
      }
    case "group":
      return [...step.by, ...step.aggregations.filter((a) => a.fn !== "count").map((a) => a.column)];
  }
}

function applyStep(table: RawTable, step: TransformStep): RawTable {
  const has = (name: string) => table.columns.some((c) => c.name === name);
  const missing = stepInputs(step).filter((c) => c && !has(c));
  if (missing.length) throw new StepError(`Column${missing.length > 1 ? "s" : ""} not found: ${missing.join(", ")}`);

  switch (step.type) {
    case "rename": {
      const to = step.to.trim();
      if (!to) throw new StepError("New name is empty");
      if (to !== step.column && has(to)) throw new StepError(`A column named “${to}” already exists`);
      return {
        columns: table.columns.map((c) => (c.name === step.column ? { ...c, name: to } : c)),
        rows: table.rows.map((r) => {
          const { [step.column]: value, ...rest } = r;
          return { ...rest, [to]: value };
        }),
      };
    }
    case "select": {
      const set = new Set(step.columns);
      const columns = table.columns.filter((c) => (step.mode === "keep" ? set.has(c.name) : !set.has(c.name)));
      if (columns.length === 0) throw new StepError("Step would remove every column");
      return {
        columns,
        rows: table.rows.map((r) => Object.fromEntries(columns.map((c) => [c.name, r[c.name] ?? null]))),
      };
    }
    case "cast": {
      return {
        columns: table.columns.map((c) => (c.name === step.column ? { ...c, type: step.to } : c)),
        rows: table.rows.map((r) => {
          const v = coerce(r[step.column], step.to);
          return { ...r, [step.column]: v === undefined ? null : v };
        }),
      };
    }
    case "filter": {
      const col = table.columns.find((c) => c.name === step.column)!;
      return { columns: table.columns, rows: table.rows.filter((r) => compare(r[step.column], step.operator, step.value, col.type)) };
    }
    case "fill_empty": {
      const col = table.columns.find((c) => c.name === step.column)!;
      if (step.strategy === "drop_row") {
        return { columns: table.columns, rows: table.rows.filter((r) => !isEmpty(r[step.column])) };
      }
      const fill = step.strategy === "zero" ? 0 : (coerce(step.value, col.type) ?? step.value);
      return {
        columns: table.columns,
        rows: table.rows.map((r) => (isEmpty(r[step.column]) ? { ...r, [step.column]: fill as CellValue } : r)),
      };
    }
    case "calculated": {
      const name = step.name.trim();
      if (!name) throw new StepError("Column name is empty");
      if (has(name)) throw new StepError(`A column named “${name}” already exists`);
      let expr;
      try {
        expr = parseExpression(step.expression);
      } catch (e) {
        throw new StepError(e instanceof ExpressionError ? e.message : "Invalid expression");
      }
      return {
        columns: [...table.columns, { name, type: step.resultType }],
        rows: table.rows.map((r) => {
          let v = evaluate(expr, r);
          if (step.resultType === "number") v = typeof v === "number" && Number.isFinite(v) ? v : typeof v === "boolean" ? Number(v) : null;
          else v = v === null ? null : String(v);
          return { ...r, [name]: v };
        }),
      };
    }
    case "group": {
      if (step.aggregations.length === 0 && step.by.length === 0) throw new StepError("Choose at least one group or aggregation");
      const outNames = [...step.by, ...step.aggregations.map((a) => a.as.trim())];
      if (outNames.some((n) => !n)) throw new StepError("Every aggregation needs an output name");
      if (new Set(outNames).size !== outNames.length) throw new StepError("Output column names must be unique");
      const groups = new Map<string, Row[]>();
      for (const r of table.rows) {
        const key = JSON.stringify(step.by.map((b) => r[b] ?? null));
        const list = groups.get(key);
        if (list) list.push(r);
        else groups.set(key, [r]);
      }
      const rows: Row[] = [];
      for (const [key, list] of groups) {
        const keys = JSON.parse(key) as CellValue[];
        const row: Row = {};
        step.by.forEach((b, i) => (row[b] = keys[i]));
        for (const a of step.aggregations) {
          row[a.as.trim()] = aggregate(list.map((r) => (a.fn === "count" ? 1 : r[a.column])), a.fn);
        }
        rows.push(row);
      }
      return {
        columns: [
          ...step.by.map((b) => table.columns.find((c) => c.name === b)!),
          ...step.aggregations.map((a) => ({ name: a.as.trim(), type: "number" as const })),
        ],
        rows,
      };
    }
  }
}

class StepError extends Error {}

/**
 * Run an ordered pipeline. A failing step is reported and skipped; later steps
 * keep running against the last good table so one mistake doesn't blank the preview.
 */
export function runPipeline(input: RawTable, steps: TransformStep[]): PipelineResult {
  let table = input;
  const results: StepResult[] = [];
  for (const step of steps) {
    const rowsIn = table.rows.length;
    const columnsIn = table.columns;
    if (!step.enabled) {
      results.push({ stepId: step.id, status: "disabled", rowsIn, rowsOut: rowsIn, columnsOut: table.columns.length, columnsIn });
      continue;
    }
    try {
      table = applyStep(table, step);
      results.push({ stepId: step.id, status: "ok", rowsIn, rowsOut: table.rows.length, columnsOut: table.columns.length, columnsIn });
    } catch (e) {
      results.push({
        stepId: step.id,
        status: "error",
        message: e instanceof Error ? e.message : "Step failed",
        rowsIn,
        rowsOut: rowsIn,
        columnsOut: table.columns.length,
        columnsIn,
      });
    }
  }
  return { table, steps: results };
}

export const STEP_LABELS: Record<TransformStep["type"], string> = {
  rename: "Rename column",
  select: "Select columns",
  cast: "Change type",
  filter: "Filter rows",
  fill_empty: "Handle empty values",
  calculated: "Calculated column",
  group: "Group & aggregate",
};

export const AGG_LABELS: Record<AggregateFn, string> = {
  sum: "Sum",
  avg: "Average",
  count: "Count",
  count_distinct: "Count distinct",
  min: "Min",
  max: "Max",
};

export const OPERATOR_LABELS: Record<string, string> = {
  eq: "equals",
  neq: "does not equal",
  gt: "greater than",
  gte: "at least",
  lt: "less than",
  lte: "at most",
  contains: "contains",
  not_contains: "does not contain",
  is_empty: "is empty",
  not_empty: "is not empty",
};

export function describeStep(step: TransformStep): string {
  switch (step.type) {
    case "rename":
      return `${step.column} → ${step.to || "…"}`;
    case "select":
      return `${step.mode === "keep" ? "Keep" : "Remove"} ${step.columns.length ? step.columns.join(", ") : "no columns"}`;
    case "cast":
      return `${step.column} as ${step.to}`;
    case "filter":
      return `${step.column} ${OPERATOR_LABELS[step.operator]}${["is_empty", "not_empty"].includes(step.operator) ? "" : ` ${step.value || "…"}`}`;
    case "fill_empty":
      return step.strategy === "drop_row"
        ? `Drop rows where ${step.column} is empty`
        : `Fill empty ${step.column} with ${step.strategy === "zero" ? "0" : `“${step.value}”`}`;
    case "calculated":
      return `${step.name || "…"} = ${step.expression || "…"}`;
    case "group":
      return `By ${step.by.join(", ") || "—"} · ${step.aggregations.map((a) => `${a.fn.toUpperCase()}(${a.fn === "count" ? "*" : a.column})`).join(", ") || "—"}`;
  }
}
