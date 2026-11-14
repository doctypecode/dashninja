"use client";

import * as React from "react";
import { AlertTriangleIcon, CalendarIcon, HashIcon, ToggleLeftIcon, TypeIcon } from "lucide-react";
import type { ColumnSchema, ColumnType } from "@/lib/model/types";
import { Label } from "@/components/ui/label";
import { Switch as SwitchControl } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-b border-border px-4 py-4 last:border-0">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Row({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export const TYPE_ICON: Record<ColumnType, React.ComponentType<{ className?: string }>> = {
  string: TypeIcon,
  number: HashIcon,
  date: CalendarIcon,
  boolean: ToggleLeftIcon,
};

export function TypeGlyph({ type, className }: { type: ColumnType; className?: string }) {
  const Icon = TYPE_ICON[type];
  return <Icon className={cn("size-3 text-muted-foreground", className)} />;
}

const NONE = "__none__";

/**
 * Field picker bound to a dataset schema. A value that is not in the schema is
 * shown as invalid with its old name — never silently replaced.
 */
export function FieldSelect({
  id,
  value,
  onChange,
  columns,
  allow,
  placeholder = "Choose a field",
  allowNone,
  noneLabel = "None",
  disabled,
}: {
  id?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  columns: ColumnSchema[];
  allow?: ColumnType[];
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
}) {
  const options = allow ? columns.filter((c) => allow.includes(c.type)) : columns;
  const missing = value !== null && !columns.some((c) => c.name === value);
  const wrongType = !missing && value !== null && allow && !options.some((c) => c.name === value);
  return (
    <div className="grid gap-1" data-invalid={missing || wrongType || undefined}>
      <Select value={value ?? (allowNone ? NONE : undefined)} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
        <SelectTrigger id={id} size="sm" aria-invalid={missing || wrongType || undefined} className={cn((missing || wrongType) && "border-warning ring-3 ring-warning/15")}>
          <SelectValue placeholder={placeholder}>
            {value === null ? (allowNone ? noneLabel : undefined) : (
              <span className="flex items-center gap-1.5 font-mono text-xs">
                {missing ? <AlertTriangleIcon className="size-3 text-warning" /> : <TypeGlyph type={columns.find((c) => c.name === value)!.type} />}
                <span className={cn(missing && "line-through decoration-warning")}>{value}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allowNone ? (
            <>
              <SelectItem value={NONE}>{noneLabel}</SelectItem>
              <SelectSeparator />
            </>
          ) : null}
          {missing ? (
            <SelectItem value={value!} disabled>
              <span className="font-mono text-xs line-through">{value}</span> (missing)
            </SelectItem>
          ) : null}
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No {allow?.join(" or ")} fields in this dataset</div>
          ) : (
            options.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                <span className="flex items-center gap-1.5 font-mono text-xs">
                  <TypeGlyph type={c.type} />
                  {c.name}
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {missing ? (
        <p className="flex items-center gap-1 text-[11px] text-warning" role="alert">
          <AlertTriangleIcon className="size-3" aria-hidden /> “{value}” no longer exists. Choose a replacement.
        </p>
      ) : wrongType ? (
        <p className="flex items-center gap-1 text-[11px] text-warning" role="alert">
          <AlertTriangleIcon className="size-3" aria-hidden /> “{value}” has the wrong type for this setting.
        </p>
      ) : null}
    </div>
  );
}

export function SimpleSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  disabled,
}: {
  id?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <SelectTrigger id={id} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full items-center gap-0.5 rounded-md border border-border bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-6 flex-1 items-center justify-center gap-1 rounded-[4px] px-1.5 text-xs font-medium transition-colors duration-150 [&_svg]:size-3.5",
            value === o.value ? "bg-surface text-foreground shadow-surface" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SwitchRow({ label, checked, onChange, disabled, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <label htmlFor={id} className="text-[13px]">
          {label}
        </label>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      <SwitchControl id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

