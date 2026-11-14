"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";
import type { AggregateFn, ColumnSchema, ColumnType, FilterOperator, TransformStep } from "@/lib/model/types";
import { AGG_LABELS, OPERATOR_LABELS } from "@/lib/data/transform";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldSelect, Row, Segmented, SimpleSelect } from "../design/inspector-fields";

const TYPES: { value: ColumnType; label: string }[] = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
];

export function defaultStep(type: TransformStep["type"], columns: ColumnSchema[], id: string): TransformStep {
  const first = columns[0]?.name ?? "";
  const firstNum = columns.find((c) => c.type === "number")?.name ?? first;
  const firstText = columns.find((c) => c.type === "string")?.name ?? first;
  switch (type) {
    case "rename":
      return { id, enabled: true, type, column: first, to: "" };
    case "select":
      return { id, enabled: true, type, mode: "remove", columns: [] };
    case "cast":
      return { id, enabled: true, type, column: first, to: "number" };
    case "filter":
      return { id, enabled: true, type, column: firstText, operator: "eq", value: "" };
    case "fill_empty":
      return { id, enabled: true, type, column: first, strategy: "value", value: "" };
    case "calculated":
      return { id, enabled: true, type, name: "new_column", expression: "", resultType: "number" };
    case "group":
      return { id, enabled: true, type, by: firstText ? [firstText] : [], aggregations: [{ column: firstNum, fn: "sum", as: firstNum ? `total_${firstNum}` : "total" }] };
  }
}

export function StepEditor({
  step,
  columns,
  onChange,
}: {
  step: TransformStep;
  columns: ColumnSchema[];
  onChange: (s: TransformStep, coalesceKey?: string) => void;
}) {
  switch (step.type) {
    case "rename":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Column">
            <FieldSelect value={step.column} onChange={(v) => onChange({ ...step, column: v ?? "" })} columns={columns} />
          </Row>
          <Row label="New name">
            <Input className="h-8 font-mono text-xs" value={step.to} onChange={(e) => onChange({ ...step, to: e.target.value }, "to")} placeholder="e.g. revenue_usd" />
          </Row>
        </div>
      );
    case "select":
      return (
        <div className="grid gap-3">
          <Segmented
            label="Mode"
            value={step.mode}
            onChange={(mode) => onChange({ ...step, mode })}
            options={[
              { value: "keep", label: "Keep selected" },
              { value: "remove", label: "Remove selected" },
            ]}
          />
          <div className="grid max-h-44 grid-cols-2 gap-0.5 overflow-auto rounded-md border border-border p-1">
            {columns.map((c) => (
              <label key={c.name} className="flex cursor-pointer items-center gap-2 rounded-[4px] px-1.5 py-1 text-xs hover:bg-muted">
                <Checkbox
                  checked={step.columns.includes(c.name)}
                  onCheckedChange={(on) => onChange({ ...step, columns: on ? [...step.columns, c.name] : step.columns.filter((x) => x !== c.name) })}
                />
                <span className="truncate font-mono">{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      );
    case "cast":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Column">
            <FieldSelect value={step.column} onChange={(v) => onChange({ ...step, column: v ?? "" })} columns={columns} />
          </Row>
          <Row label="Convert to" hint="Values that can’t be converted become empty.">
            <SimpleSelect value={step.to} onChange={(to) => onChange({ ...step, to })} options={TYPES} />
          </Row>
        </div>
      );
    case "filter": {
      const noValue = step.operator === "is_empty" || step.operator === "not_empty";
      const type = columns.find((c) => c.name === step.column)?.type ?? "string";
      const ops: FilterOperator[] =
        type === "number" || type === "date"
          ? ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "not_empty"]
          : ["eq", "neq", "contains", "not_contains", "is_empty", "not_empty"];
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <Row label="Column">
            <FieldSelect value={step.column} onChange={(v) => onChange({ ...step, column: v ?? "" })} columns={columns} />
          </Row>
          <Row label="Condition">
            <SimpleSelect value={step.operator} onChange={(operator) => onChange({ ...step, operator })} options={ops.map((o) => ({ value: o, label: OPERATOR_LABELS[o] }))} />
          </Row>
          {!noValue ? (
            <Row label="Value">
              <Input
                className="h-8 font-mono text-xs"
                value={step.value}
                type={type === "date" ? "date" : "text"}
                inputMode={type === "number" ? "decimal" : undefined}
                onChange={(e) => onChange({ ...step, value: e.target.value }, "value")}
                placeholder={type === "number" ? "0" : "value"}
              />
            </Row>
          ) : null}
        </div>
      );
    }
    case "fill_empty":
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <Row label="Column">
            <FieldSelect value={step.column} onChange={(v) => onChange({ ...step, column: v ?? "" })} columns={columns} />
          </Row>
          <Row label="When empty">
            <SimpleSelect
              value={step.strategy}
              onChange={(strategy) => onChange({ ...step, strategy })}
              options={[
                { value: "value", label: "Fill with value" },
                { value: "zero", label: "Fill with 0" },
                { value: "drop_row", label: "Remove the row" },
              ]}
            />
          </Row>
          {step.strategy === "value" ? (
            <Row label="Value">
              <Input className="h-8 font-mono text-xs" value={step.value} onChange={(e) => onChange({ ...step, value: e.target.value }, "value")} placeholder="Unknown" />
            </Row>
          ) : null}
        </div>
      );
    case "calculated":
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Row label="Column name">
              <Input className="h-8 font-mono text-xs" value={step.name} onChange={(e) => onChange({ ...step, name: e.target.value }, "name")} />
            </Row>
            <Row label="Result type">
              <SimpleSelect value={step.resultType} onChange={(resultType) => onChange({ ...step, resultType })} options={[{ value: "number", label: "Number" }, { value: "string", label: "Text" }]} />
            </Row>
          </div>
          <Row
            label="Formula"
            hint={
              <>
                Use column names, <span className="font-mono">+ − × ÷</span>, and functions like <span className="font-mono">round(x, 1)</span>,{" "}
                <span className="font-mono">if(a &gt; b, x, y)</span>, <span className="font-mono">concat(a, &quot; &quot;, b)</span>. Wrap names with spaces in [brackets].
              </>
            }
          >
            <Input className="h-8 font-mono text-xs" value={step.expression} onChange={(e) => onChange({ ...step, expression: e.target.value }, "expression")} placeholder="revenue - cost" spellCheck={false} />
          </Row>
          <div className="flex flex-wrap gap-1">
            {columns.slice(0, 12).map((c) => (
              <button
                key={c.name}
                type="button"
                className="rounded-[4px] border border-border bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground hover:border-border-strong hover:text-foreground"
                onClick={() => onChange({ ...step, expression: `${step.expression}${step.expression && !step.expression.endsWith(" ") ? " " : ""}${/^[A-Za-z_][A-Za-z0-9_]*$/.test(c.name) ? c.name : `[${c.name}]`}` })}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      );
    case "group":
      return (
        <div className="grid gap-3">
          <Row label="Group by">
            <div className="flex flex-wrap gap-1">
              {columns
                .filter((c) => c.type !== "number")
                .map((c) => {
                  const on = step.by.includes(c.name);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onChange({ ...step, by: on ? step.by.filter((x) => x !== c.name) : [...step.by, c.name] })}
                      className={
                        on
                          ? "rounded-[4px] border border-primary bg-primary px-1.5 py-0.5 font-mono text-[10.5px] text-primary-foreground"
                          : "rounded-[4px] border border-border bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground hover:border-border-strong hover:text-foreground"
                      }
                    >
                      {c.name}
                    </button>
                  );
                })}
            </div>
          </Row>
          <Row label="Aggregations">
            <div className="grid gap-1.5">
              {step.aggregations.map((a, i) => (
                <div key={i} className="grid grid-cols-[110px_1fr_1fr_auto] items-center gap-1.5">
                  <SimpleSelect<AggregateFn>
                    value={a.fn}
                    onChange={(fn) => onChange({ ...step, aggregations: step.aggregations.map((x, j) => (j === i ? { ...x, fn } : x)) })}
                    options={(Object.keys(AGG_LABELS) as AggregateFn[]).map((k) => ({ value: k, label: AGG_LABELS[k] }))}
                  />
                  {a.fn === "count" ? (
                    <div className="flex h-8 items-center rounded-md border border-dashed border-border px-2 font-mono text-xs text-muted-foreground">rows</div>
                  ) : (
                    <FieldSelect
                      value={a.column || null}
                      onChange={(v) => onChange({ ...step, aggregations: step.aggregations.map((x, j) => (j === i ? { ...x, column: v ?? "" } : x)) })}
                      columns={columns}
                      allow={a.fn === "count_distinct" ? undefined : ["number"]}
                      placeholder="Field"
                    />
                  )}
                  <Input
                    className="h-8 font-mono text-xs"
                    value={a.as}
                    aria-label="Output column"
                    onChange={(e) => onChange({ ...step, aggregations: step.aggregations.map((x, j) => (j === i ? { ...x, as: e.target.value } : x)) }, `as-${i}`)}
                  />
                  <Button variant="ghost" size="icon-xs" aria-label="Remove aggregation" onClick={() => onChange({ ...step, aggregations: step.aggregations.filter((_, j) => j !== i) })}>
                    <XIcon />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="xs"
                className="justify-self-start"
                onClick={() => onChange({ ...step, aggregations: [...step.aggregations, { column: columns.find((c) => c.type === "number")?.name ?? "", fn: "sum", as: `agg_${step.aggregations.length + 1}` }] })}
              >
                <PlusIcon /> Add aggregation
              </Button>
            </div>
          </Row>
        </div>
      );
  }
}
