"use client";

import * as React from "react";
import {
  AlertTriangleIcon,
  AlignCenterIcon,
  AlignLeftIcon,
  DatabaseIcon,
  PlusIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import type {
  AggregateFn,
  ChartColor,
  ChartOptions,
  DashboardAppearance,
  DataBinding,
  DataWidget,
  DateGrain,
  DateRangePreset,
  FilterWidget,
  Measure,
  NumberFormatKind,
  TextWidget,
  ValueFormat,
  Widget,
  WidgetStyle,
} from "@/lib/model/types";
import { isDataWidget } from "@/lib/model/types";
import { WIDGET_LABELS } from "@/lib/model/defaults";
import { AGG_LABELS } from "@/lib/data/transform";
import { RANGE_LABELS } from "@/lib/data/query";
import { useBuilder } from "@/lib/builder/store";
import { useRuntime, seriesColor } from "@/components/widgets/runtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FieldListEditor, FieldSelect, Row, Section, Segmented, SimpleSelect, SwitchRow } from "./inspector-fields";
import { WIDGET_ICONS } from "./widget-palette";

export function Inspector({ onClose }: { onClose: () => void }) {
  const b = useBuilder();
  const w = b.selected;
  const Icon = w ? WIDGET_ICONS[w.type] : null;
  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-border bg-surface px-4">
        {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
        <h2 className="flex-1 truncate text-[13px] font-medium">{w ? WIDGET_LABELS[w.type] : "Dashboard settings"}</h2>
        {w ? (
          <Button variant="ghost" size="xs" onClick={() => b.select(null)}>
            Deselect
          </Button>
        ) : null}
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close inspector">
          <XIcon />
        </Button>
      </div>
      {w ? <WidgetInspector key={w.id} widget={w} /> : <DashboardSettings />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function useWidgetUpdater(widget: Widget) {
  const b = useBuilder();
  return React.useCallback(
    <T extends Widget>(recipe: (w: T) => T, coalesceKey?: string) => b.updateWidget(widget.id, (w) => recipe(w as T), coalesceKey),
    [b, widget.id],
  );
}

function WidgetInspector({ widget }: { widget: Widget }) {
  const b = useBuilder();
  const firstTab = widget.type === "text" ? "content" : widget.type === "filter" ? "filter" : "data";
  const [tab, setTab] = React.useState(firstTab);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Repair: jump to the binding tab and focus the first invalid field.
  React.useEffect(() => {
    if (b.repairId !== widget.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- respond to an explicit repair request
    setTab(firstTab);
    const t = setTimeout(() => {
      const el = containerRef.current?.querySelector<HTMLElement>("[data-invalid] button, [data-invalid] [role=combobox]");
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus();
      b.requestRepair(null);
    }, 60);
    return () => clearTimeout(t);
  }, [b, b.repairId, widget.id, firstTab]);

  return (
    <div ref={containerRef}>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="border-b border-border px-4 py-2.5">
          <TabsList className="w-full">
            {widget.type === "text" ? <TabsTrigger value="content">Content</TabsTrigger> : null}
            {widget.type === "filter" ? <TabsTrigger value="filter">Filter</TabsTrigger> : null}
            {isDataWidget(widget) ? (
              <>
                <TabsTrigger value="data">Data</TabsTrigger>
                <TabsTrigger value="format">Format</TabsTrigger>
              </>
            ) : null}
            <TabsTrigger value="style">Style</TabsTrigger>
          </TabsList>
        </div>
        {isDataWidget(widget) ? (
          <>
            <TabsContent value="data">
              <GeneralSection widget={widget} />
              <BindingSection widget={widget} />
              <FilterBindingsSection widget={widget} />
            </TabsContent>
            <TabsContent value="format">
              <FormatSection widget={widget} />
            </TabsContent>
          </>
        ) : null}
        {widget.type === "text" ? (
          <TabsContent value="content">
            <TextSection widget={widget} />
          </TabsContent>
        ) : null}
        {widget.type === "filter" ? (
          <TabsContent value="filter">
            <GeneralSection widget={widget} hideDescription />
            <FilterSection widget={widget} />
          </TabsContent>
        ) : null}
        <TabsContent value="style">
          <StyleSection widget={widget} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GeneralSection({ widget, hideDescription }: { widget: Widget; hideDescription?: boolean }) {
  const update = useWidgetUpdater(widget);
  return (
    <Section title="General">
      <Row label="Title" htmlFor="w-title">
        <Input id="w-title" className="h-8 text-[13px]" value={widget.title} onChange={(e) => update((w) => ({ ...w, title: e.target.value }), "title")} />
      </Row>
      {!hideDescription ? (
        <Row label="Description" htmlFor="w-desc">
          <Textarea
            id="w-desc"
            className="min-h-14 text-[13px]"
            value={widget.description}
            onChange={(e) => update((w) => ({ ...w, description: e.target.value }), "description")}
            placeholder="Optional context for viewers"
          />
        </Row>
      ) : null}
    </Section>
  );
}

function DatasetPicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const { dashboard, tables, onRequestData } = useRuntime();
  const missing = value !== null && !dashboard.datasets.some((d) => d.id === value);
  if (dashboard.datasets.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-strong p-3 text-xs text-muted-foreground">
        No datasets yet.{" "}
        {onRequestData ? (
          <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={onRequestData}>
            Connect data
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="grid gap-1" data-invalid={missing || undefined}>
      <Select value={missing ? undefined : (value ?? undefined)} onValueChange={onChange}>
        <SelectTrigger size="sm" aria-invalid={missing || undefined} className={cn(missing && "border-warning ring-3 ring-warning/15")}>
          <SelectValue placeholder={missing ? "Dataset was removed — choose another" : "Choose a dataset"} />
        </SelectTrigger>
        <SelectContent>
          {dashboard.datasets.map((d) => {
            const src = dashboard.sources.find((s) => s.id === d.sourceId);
            const t = tables.get(d.id);
            return (
              <SelectItem key={d.id} value={d.id}>
                <span className="flex items-center gap-2">
                  <DatabaseIcon className="size-3 text-muted-foreground" />
                  {d.name}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {src?.name} · {t?.rows.length ?? 0} rows
                  </span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {missing ? (
        <p className="flex items-center gap-1 text-[11px] text-warning" role="alert">
          <AlertTriangleIcon className="size-3" /> The dataset this widget used was removed.
        </p>
      ) : null}
    </div>
  );
}

const AGGS: AggregateFn[] = ["sum", "avg", "count", "count_distinct", "min", "max"];

function MeasureRow({
  measure,
  columns,
  onChange,
  onRemove,
  index,
}: {
  measure: Measure;
  columns: ReturnType<typeof useSchema>;
  onChange: (m: Measure) => void;
  onRemove?: () => void;
  index: number;
}) {
  const counts = measure.agg === "count";
  return (
    <div className="grid gap-1.5 rounded-md border border-border bg-background p-2">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-muted-foreground">Y{index + 1}</span>
        <div className="w-[104px] shrink-0">
          <Select value={measure.agg} onValueChange={(v) => onChange({ ...measure, agg: v as AggregateFn })}>
            <SelectTrigger size="sm" aria-label="Aggregation" className="font-mono text-xs uppercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGGS.map((a) => (
                <SelectItem key={a} value={a}>
                  {AGG_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 flex-1">
          {counts ? (
            <div className="flex h-8 items-center rounded-md border border-dashed border-border px-2 font-mono text-xs text-muted-foreground">rows</div>
          ) : (
            <FieldSelect value={measure.field || null} onChange={(v) => onChange({ ...measure, field: v ?? "" })} columns={columns} allow={measure.agg === "count_distinct" ? undefined : ["number"]} placeholder="Field" />
          )}
        </div>
        {onRemove ? (
          <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label="Remove measure">
            <XIcon />
          </Button>
        ) : null}
      </div>
      <Input
        className="h-7 text-xs"
        placeholder={`Label (default: ${counts ? "Count" : `${AGG_LABELS[measure.agg]} of ${measure.field || "…"}`})`}
        value={measure.label ?? ""}
        onChange={(e) => onChange({ ...measure, label: e.target.value || undefined })}
        aria-label="Series label"
      />
    </div>
  );
}

function useSchema(datasetId: string | null) {
  const { tables } = useRuntime();
  return (datasetId ? tables.get(datasetId)?.columns : undefined) ?? [];
}

function bindingSummary(b: DataBinding, datasetName: string | undefined) {
  const m = b.measures.map((x) => `${x.agg.toUpperCase()}(${x.agg === "count" ? "*" : x.field || "?"})`).join(", ") || "—";
  const dim = b.dimension ? ` BY ${b.dateGrain !== "day" ? `${b.dateGrain}(${b.dimension})` : b.dimension}` : "";
  const ser = b.series ? ` SPLIT ${b.series}` : "";
  return `${m}${dim}${ser}${datasetName ? ` FROM ${datasetName}` : ""}`;
}

function BindingSection({ widget }: { widget: DataWidget }) {
  const update = useWidgetUpdater(widget);
  const { datasetNames } = useRuntime();
  const b = widget.binding;
  const columns = useSchema(b.datasetId);
  const dimType = columns.find((c) => c.name === b.dimension)?.type;
  const setBinding = (patch: Partial<DataBinding>, key?: string) =>
    update<DataWidget>((w) => ({ ...w, binding: { ...w.binding, ...patch } }), key);

  const tableMode = widget.type === "table" ? (b.dimension || b.columns.length === 0 ? "grouped" : "rows") : null;
  const [mode, setMode] = React.useState<"grouped" | "rows">(tableMode ?? "grouped");

  return (
    <Section title="Binding">
      <Row label="Dataset">
        <DatasetPicker
          value={b.datasetId}
          onChange={(id) => setBinding({ datasetId: id })}
        />
      </Row>

      {b.datasetId && columns.length > 0 ? (
        <>
          {widget.type === "kpi" ? (
            <>
              <Row label="Measure">
                <MeasureRow
                  index={0}
                  measure={b.measures[0] ?? { field: "", agg: "sum" }}
                  columns={columns}
                  onChange={(m) => setBinding({ measures: [m] })}
                />
              </Row>
              <Row label="Trend date field" hint="Used for the sparkline and month-over-month change.">
                <FieldSelect
                  value={widget.options.dateField}
                  onChange={(v) => update<typeof widget>((w) => ({ ...w, options: { ...w.options, dateField: v } }))}
                  columns={columns}
                  allow={["date"]}
                  allowNone
                  noneLabel="No trend"
                />
              </Row>
              <SwitchRow
                label="Compare with prior month"
                checked={widget.options.comparison === "previous_period"}
                disabled={!widget.options.dateField}
                onChange={(v) => update<typeof widget>((w) => ({ ...w, options: { ...w.options, comparison: v ? "previous_period" : "none" } }))}
              />
              <SwitchRow
                label="Sparkline"
                checked={widget.options.showSparkline}
                disabled={!widget.options.dateField}
                onChange={(v) => update<typeof widget>((w) => ({ ...w, options: { ...w.options, showSparkline: v } }))}
              />
            </>
          ) : (
            <>
              {widget.type === "table" ? (
                <Row label="Table shows">
                  <Segmented
                    label="Table mode"
                    value={mode}
                    onChange={(v) => {
                      setMode(v);
                      if (v === "rows") setBinding({ dimension: null, measures: [], columns: b.columns.length ? b.columns : columns.slice(0, 5).map((c) => c.name) });
                      else setBinding({ columns: [] });
                    }}
                    options={[
                      { value: "grouped", label: "Grouped values" },
                      { value: "rows", label: "Raw rows" },
                    ]}
                  />
                </Row>
              ) : null}

              {widget.type === "table" && mode === "rows" ? (
                <Row label="Columns">
                  <div className="grid max-h-56 gap-0.5 overflow-auto rounded-md border border-border p-1">
                    {columns.map((c) => (
                      <label key={c.name} className="flex cursor-pointer items-center gap-2 rounded-[4px] px-1.5 py-1 text-xs hover:bg-muted">
                        <Checkbox
                          checked={b.columns.includes(c.name)}
                          onCheckedChange={(on) =>
                            setBinding({ columns: on ? [...b.columns, c.name] : b.columns.filter((x) => x !== c.name) })
                          }
                        />
                        <span className="font-mono">{c.name}</span>
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{c.type}</span>
                      </label>
                    ))}
                    {b.columns
                      .filter((c) => !columns.some((x) => x.name === c))
                      .map((c) => (
                        <div key={c} data-invalid className="flex items-center gap-2 rounded-[4px] bg-warning-muted px-1.5 py-1 text-xs text-warning">
                          <AlertTriangleIcon className="size-3" />
                          <span className="font-mono line-through">{c}</span> missing
                          <button type="button" className="ml-auto underline" onClick={() => setBinding({ columns: b.columns.filter((x) => x !== c) })}>
                            Remove
                          </button>
                        </div>
                      ))}
                  </div>
                </Row>
              ) : (
                <>
                  <Row label={widget.type === "table" ? "Group rows by" : "X-axis"}>
                    <FieldSelect value={b.dimension} onChange={(v) => setBinding({ dimension: v })} columns={columns} placeholder="Choose a field" />
                  </Row>
                  {dimType === "date" ? (
                    <Row label="Date grain">
                      <Segmented<DateGrain>
                        label="Date grain"
                        value={b.dateGrain}
                        onChange={(v) => setBinding({ dateGrain: v })}
                        options={[
                          { value: "day", label: "Day" },
                          { value: "week", label: "Week" },
                          { value: "month", label: "Month" },
                          { value: "quarter", label: "Qtr" },
                          { value: "year", label: "Year" },
                        ]}
                      />
                    </Row>
                  ) : null}
                  <Row label={widget.type === "table" ? "Measures" : "Y-axis"}>
                    <div className="grid gap-1.5">
                      {b.measures.map((m, i) => (
                        <MeasureRow
                          key={i}
                          index={i}
                          measure={m}
                          columns={columns}
                          onChange={(next) => setBinding({ measures: b.measures.map((x, j) => (j === i ? next : x)) }, `measure-label-${i}`)}
                          onRemove={() => setBinding({ measures: b.measures.filter((_, j) => j !== i) })}
                        />
                      ))}
                      {b.measures.length < 4 ? (
                        <Button
                          variant="outline"
                          size="xs"
                          className="justify-self-start"
                          onClick={() =>
                            setBinding({
                              measures: [...b.measures, { field: columns.find((c) => c.type === "number")?.name ?? "", agg: columns.some((c) => c.type === "number") ? "sum" : "count" }],
                              series: b.measures.length >= 1 ? null : b.series,
                            })
                          }
                        >
                          <PlusIcon /> Add measure
                        </Button>
                      ) : null}
                    </div>
                  </Row>
                  {widget.type !== "table" ? (
                    <Row label="Split into series" hint={b.measures.length > 1 ? "Available with a single measure." : "One line or bar color per category."}>
                      <FieldSelect value={b.series} onChange={(v) => setBinding({ series: v })} columns={columns} allow={["string", "boolean"]} allowNone noneLabel="No split" disabled={b.measures.length > 1} />
                    </Row>
                  ) : null}
                  {widget.type !== "table" && b.dimension ? (
                    <>
                      <Row label="Viewer can switch to" hint="Adds a toggle on the chart, for example Month, Category, Region.">
                        <FieldListEditor
                          label="Alternate X-axis fields"
                          fields={b.views ?? []}
                          columns={columns}
                          exclude={[b.dimension]}
                          onChange={(views) => setBinding({ views })}
                          addLabel="Add a toggle option"
                        />
                      </Row>
                      <Row label="Drill-down path" hint={`Clicking a ${widget.type === "bar" ? "bar" : "point"} filters to it and shows the next level. Starts from ${b.dimension}.`}>
                        <FieldListEditor
                          label="Drill-down levels"
                          fields={b.drill ?? []}
                          columns={columns}
                          exclude={[b.dimension]}
                          onChange={(drill) => setBinding({ drill })}
                          addLabel="Add a drill level"
                          ordered
                        />
                      </Row>
                    </>
                  ) : null}
                  <Row label="Sort">
                    <div className="grid grid-cols-2 gap-1.5">
                      <Segmented
                        label="Sort by"
                        value={b.sort.by}
                        onChange={(v) => setBinding({ sort: { ...b.sort, by: v } })}
                        options={[
                          { value: "dimension", label: widget.type === "table" ? "Group" : "X-axis" },
                          { value: "measure", label: "Value" },
                        ]}
                      />
                      <Segmented
                        label="Sort direction"
                        value={b.sort.direction}
                        onChange={(v) => setBinding({ sort: { ...b.sort, direction: v } })}
                        options={[
                          { value: "asc", label: "Asc" },
                          { value: "desc", label: "Desc" },
                        ]}
                      />
                    </div>
                  </Row>
                  <Row label="Limit" htmlFor="w-limit" hint="Show only the first N groups after sorting.">
                    <Input
                      id="w-limit"
                      type="number"
                      min={1}
                      className="h-8 w-24 text-[13px] tabular"
                      value={b.limit ?? ""}
                      placeholder="All"
                      onChange={(e) => setBinding({ limit: e.target.value ? Math.max(1, Number(e.target.value)) : null }, "limit")}
                    />
                  </Row>
                </>
              )}
            </>
          )}
          <code className="block rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed break-words text-muted-foreground">
            {bindingSummary(b, b.datasetId ? datasetNames.get(b.datasetId) : undefined)}
          </code>
        </>
      ) : null}
    </Section>
  );
}

function FilterBindingsSection({ widget }: { widget: DataWidget }) {
  const update = useWidgetUpdater(widget);
  const { filters } = useRuntime();
  const columns = useSchema(widget.binding.datasetId);
  if (filters.length === 0) {
    return (
      <Section title="Dashboard filters">
        <p className="text-xs text-muted-foreground">Add a Dashboard filter widget to let viewers slice this widget.</p>
      </Section>
    );
  }
  return (
    <Section title="Dashboard filters">
      <div className="grid gap-1">
        {filters.map((f) => {
          const field = f.options.field;
          const applicable = Boolean(field && columns.some((c) => c.name === field));
          const checked = widget.binding.filterIds.includes(f.id);
          return (
            <label key={f.id} className={cn("flex items-start gap-2 rounded-md px-1.5 py-1.5 text-[13px] hover:bg-muted", !applicable && "opacity-70")}>
              <Checkbox
                className="mt-0.5"
                checked={checked}
                onCheckedChange={(on) =>
                  update<DataWidget>((w) => ({
                    ...w,
                    binding: { ...w.binding, filterIds: on ? [...w.binding.filterIds, f.id] : w.binding.filterIds.filter((x) => x !== f.id) },
                  }))
                }
              />
              <span className="grid">
                <span>{f.title || "Filter"}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  {field ?? "no field"}
                  {!applicable && field ? " · not in this dataset, ignored" : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </Section>
  );
}

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD"];

function FormatSection({ widget }: { widget: DataWidget }) {
  const update = useWidgetUpdater(widget);
  const f = widget.format;
  const setFormat = (patch: Partial<ValueFormat>) => update<DataWidget>((w) => ({ ...w, format: { ...w.format, ...patch } }));
  return (
    <>
      <Section title="Numbers">
        <Row label="Format">
          <Segmented<NumberFormatKind>
            label="Number format"
            value={f.kind}
            onChange={(kind) => setFormat({ kind })}
            options={[
              { value: "number", label: "1,234", title: "Number" },
              { value: "compact", label: "1.2K", title: "Compact" },
              { value: "currency", label: "$", title: "Currency" },
              { value: "percent", label: "%", title: "Percentage" },
            ]}
          />
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Row label="Decimals">
            <SimpleSelect value={String(f.decimals)} onChange={(v) => setFormat({ decimals: Number(v) })} options={["0", "1", "2", "3"].map((v) => ({ value: v, label: v }))} />
          </Row>
          {f.kind === "currency" ? (
            <Row label="Currency">
              <SimpleSelect value={f.currency} onChange={(currency) => setFormat({ currency })} options={CURRENCIES.map((c) => ({ value: c, label: <span className="font-mono text-xs">{c}</span> }))} />
            </Row>
          ) : f.kind === "percent" ? (
            <Row label="Values are">
              <SimpleSelect value={f.percentScale} onChange={(percentScale) => setFormat({ percentScale })} options={[{ value: "fraction", label: "0–1" }, { value: "whole", label: "0–100" }]} />
            </Row>
          ) : null}
        </div>
      </Section>
      {"dateFormat" in widget ? (
        <Section title="Dates">
          <Row label="Date labels">
            <Segmented
              label="Date format"
              value={widget.dateFormat.style}
              onChange={(style) => update<typeof widget>((w) => ({ ...w, dateFormat: { style } }))}
              options={[
                { value: "auto", label: "Auto" },
                { value: "short", label: "Short" },
                { value: "long", label: "Long" },
                { value: "iso", label: "ISO" },
              ]}
            />
          </Row>
        </Section>
      ) : null}
    </>
  );
}

function TextSection({ widget }: { widget: TextWidget }) {
  const update = useWidgetUpdater(widget);
  return (
    <Section title="Text">
      <Row label="Content" htmlFor="w-text" hint="The first line is the heading; following lines are body text.">
        <Textarea
          id="w-text"
          className="min-h-28 text-[13px]"
          value={widget.options.content}
          onChange={(e) => update<TextWidget>((w) => ({ ...w, options: { ...w.options, content: e.target.value } }), "content")}
        />
      </Row>
      <Row label="Size">
        <Segmented
          label="Text size"
          value={widget.options.size}
          onChange={(size) => update<TextWidget>((w) => ({ ...w, options: { ...w.options, size } }))}
          options={[
            { value: "sm", label: "S" },
            { value: "md", label: "M" },
            { value: "lg", label: "L" },
            { value: "xl", label: "XL" },
          ]}
        />
      </Row>
    </Section>
  );
}

function FilterSection({ widget }: { widget: FilterWidget }) {
  const update = useWidgetUpdater(widget);
  const b = useBuilder();
  const columns = useSchema(widget.options.datasetId);
  const o = widget.options;
  const fieldType = columns.find((c) => c.name === o.field)?.type;
  const setOpts = (patch: Partial<FilterWidget["options"]>) => update<FilterWidget>((w) => ({ ...w, options: { ...w.options, ...patch } }));
  const dataWidgets = b.draft.widgets.filter(isDataWidget);
  return (
    <>
      <Section title="Filter field">
        <Row label="Dataset">
          <DatasetPicker value={o.datasetId} onChange={(id) => setOpts({ datasetId: id })} />
        </Row>
        {o.datasetId ? (
          <Row label="Field" hint="Widgets on other datasets are filtered when they have a field with the same name.">
            <FieldSelect
              value={o.field}
              onChange={(v) => {
                const t = columns.find((c) => c.name === v)?.type;
                setOpts({ field: v, control: t === "date" ? "date_range" : "select", defaultValues: [] });
              }}
              columns={columns}
              allow={["string", "date", "boolean"]}
            />
          </Row>
        ) : null}
        {fieldType === "date" ? (
          <Row label="Default range" hint="Relative to the latest date in the data.">
            <SimpleSelect<DateRangePreset>
              value={o.defaultRange}
              onChange={(defaultRange) => setOpts({ defaultRange })}
              options={(Object.keys(RANGE_LABELS) as DateRangePreset[]).map((k) => ({ value: k, label: RANGE_LABELS[k] }))}
            />
          </Row>
        ) : null}
      </Section>
      <Section title="Applies to">
        {dataWidgets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No data widgets yet.</p>
        ) : (
          <div className="grid gap-0.5">
            {dataWidgets.map((dw) => {
              const on = dw.binding.filterIds.includes(widget.id);
              return (
                <label key={dw.id} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] hover:bg-muted">
                  <Checkbox
                    checked={on}
                    onCheckedChange={(c) =>
                      b.updateWidget(dw.id, (w) =>
                        isDataWidget(w)
                          ? { ...w, binding: { ...w.binding, filterIds: c ? [...w.binding.filterIds, widget.id] : w.binding.filterIds.filter((x) => x !== widget.id) } }
                          : w,
                      )
                    }
                  />
                  <span className="truncate">{dw.title || WIDGET_LABELS[dw.type]}</span>
                </label>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}

function StyleSection({ widget }: { widget: Widget }) {
  const update = useWidgetUpdater(widget);
  const { dashboard } = useRuntime();
  const s = widget.style;
  const setStyle = (patch: Partial<WidgetStyle>) => update((w) => ({ ...w, style: { ...w.style, ...patch } }));
  const chart = widget.type === "line" || widget.type === "bar" ? widget : null;
  const setChart = (patch: Partial<ChartOptions>) =>
    update((w) => (w.type === "line" || w.type === "bar" ? { ...w, options: { ...w.options, ...patch } } : w));
  return (
    <>
      {widget.type !== "text" && widget.type !== "filter" ? (
        <Section title="Color">
          <div role="radiogroup" aria-label="Series color" className="flex flex-wrap gap-1.5">
            {([1, 2, 3, 4, 5, 6, 7, 8] as ChartColor[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={s.color === c}
                aria-label={`Color ${c}`}
                onClick={() => setStyle({ color: c })}
                className={cn(
                  "size-6 rounded-md border border-black/10 transition-[box-shadow] duration-150 dark:border-white/10",
                  s.color === c && "ring-2 ring-focus ring-offset-2 ring-offset-surface",
                )}
                style={{ background: seriesColor(c, dashboard.appearance.palette) }}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Split series use the fixed palette order so each category keeps its color.</p>
        </Section>
      ) : null}
      {chart ? (
        <Section title="Chart">
          <SwitchRow label="Legend" checked={chart.options.showLegend} onChange={(v) => setChart({ showLegend: v })} />
          <SwitchRow label="Grid lines" checked={chart.options.showGrid} onChange={(v) => setChart({ showGrid: v })} />
          {chart.type === "line" ? (
            <>
              <SwitchRow label="Point markers" checked={chart.options.showDots} onChange={(v) => setChart({ showDots: v })} />
              <Row label="Line shape">
                <Segmented label="Line shape" value={chart.options.curve} onChange={(curve) => setChart({ curve })} options={[{ value: "monotone", label: "Smooth" }, { value: "linear", label: "Straight" }, { value: "step", label: "Step" }]} />
              </Row>
            </>
          ) : (
            <>
              <SwitchRow label="Stack series" checked={chart.options.stacked} onChange={(v) => setChart({ stacked: v })} />
              <Row label="Orientation">
                <Segmented label="Orientation" value={chart.options.orientation} onChange={(orientation) => setChart({ orientation })} options={[{ value: "vertical", label: "Columns" }, { value: "horizontal", label: "Bars" }]} />
              </Row>
            </>
          )}
        </Section>
      ) : null}
      {widget.type === "table" ? (
        <Section title="Table">
          <Row label="Rows per page">
            <SimpleSelect value={String(widget.options.pageSize)} onChange={(v) => update<typeof widget>((w) => ({ ...w, options: { ...w.options, pageSize: Number(v) } }))} options={["5", "7", "8", "10", "15", "25"].map((v) => ({ value: v, label: v }))} />
          </Row>
          <SwitchRow label="Striped rows" checked={widget.options.striped} onChange={(v) => update<typeof widget>((w) => ({ ...w, options: { ...w.options, striped: v } }))} />
        </Section>
      ) : null}
      <Section title="Surface">
        <Row label="Background">
          <Segmented label="Background" value={s.background} onChange={(background) => setStyle({ background })} options={[{ value: "surface", label: "Surface" }, { value: "muted", label: "Muted" }, { value: "transparent", label: "None" }]} />
        </Row>
        <Row label="Border">
          <Segmented label="Border" value={s.border} onChange={(border) => setStyle({ border })} options={[{ value: "default", label: "Subtle" }, { value: "strong", label: "Strong" }, { value: "none", label: "None" }]} />
        </Row>
        <Row label="Spacing">
          <Segmented label="Padding" value={s.padding} onChange={(padding) => setStyle({ padding })} options={[{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal" }, { value: "relaxed", label: "Relaxed" }]} />
        </Row>
      </Section>
      <Section title="Typography">
        {widget.type !== "text" ? (
          <Row label="Title size">
            <Segmented label="Title size" value={s.titleSize} onChange={(titleSize) => setStyle({ titleSize })} options={[{ value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }]} />
          </Row>
        ) : null}
        <Row label="Alignment">
          <Segmented
            label="Alignment"
            value={s.align}
            onChange={(align) => setStyle({ align })}
            options={[
              { value: "left", label: <AlignLeftIcon aria-label="Left" /> },
              { value: "center", label: <AlignCenterIcon aria-label="Center" /> },
            ]}
          />
        </Row>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------

function DashboardSettings() {
  const b = useBuilder();
  const { dashboard, tables, issues, onRequestData, onRepair } = useRuntime();
  const a = b.draft.appearance;
  const set = (patch: Partial<DashboardAppearance>) => b.update((d) => ({ ...d, appearance: { ...d.appearance, ...patch } }));
  return (
    <>
      <div className="border-b border-border px-4 py-3 text-xs text-muted-foreground">Select a widget on the canvas to edit it. These settings apply to the whole dashboard.</div>
      {issues.length > 0 ? (
        <Section title="Needs attention">
          <ul className="grid gap-1.5">
            {issues.map((i, idx) => (
              <li key={idx} className="rounded-md border border-warning/30 bg-warning-muted p-2 text-xs">
                <p className="flex items-center gap-1.5 font-medium text-warning">
                  <AlertTriangleIcon className="size-3.5" /> {i.widgetTitle}
                </p>
                <p className="mt-0.5 text-muted-foreground">{i.message}</p>
                <Button size="xs" variant="secondary" className="mt-1.5" onClick={() => onRepair?.(i.widgetId)}>
                  <WrenchIcon /> Repair
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Section title="Status">
        <Segmented label="Status" value={b.draft.status} onChange={(status) => b.update((d) => ({ ...d, status }))} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} />
      </Section>
      <Section title="Canvas">
        <Row label="Background">
          <Segmented label="Canvas background" value={a.background} onChange={(background) => set({ background })} options={[{ value: "plain", label: "Plain" }, { value: "dots", label: "Dots" }, { value: "grid", label: "Grid" }]} />
        </Row>
        <Row label="Width">
          <Segmented label="Max width" value={a.maxWidth} onChange={(maxWidth) => set({ maxWidth })} options={[{ value: "narrow", label: "Narrow" }, { value: "wide", label: "Wide" }, { value: "full", label: "Full" }]} />
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Row label="Gap">
            <SimpleSelect value={String(a.gap)} onChange={(v) => set({ gap: Number(v) as DashboardAppearance["gap"] })} options={["8", "12", "16"].map((v) => ({ value: v, label: `${v}px` }))} />
          </Row>
          <Row label="Row height">
            <SimpleSelect value={String(a.rowHeight)} onChange={(v) => set({ rowHeight: Number(v) as DashboardAppearance["rowHeight"] })} options={["28", "32", "40"].map((v) => ({ value: v, label: `${v}px` }))} />
          </Row>
        </div>
      </Section>
      <Section title="Chart palette">
        <Segmented label="Palette" value={a.palette} onChange={(palette) => set({ palette })} options={[{ value: "default", label: "Color" }, { value: "monochrome", label: "Monochrome" }]} />
        <div className="flex gap-1" aria-hidden>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
            <span key={c} className="h-3 flex-1 rounded-sm" style={{ background: seriesColor(c, a.palette) }} />
          ))}
        </div>
      </Section>
      <Section
        title="Datasets"
        action={
          onRequestData ? (
            <Button variant="ghost" size="xs" onClick={onRequestData}>
              Manage in Data
            </Button>
          ) : null
        }
      >
        {dashboard.datasets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No datasets yet. Connect a CSV, Excel workbook or Google Sheet in the Data tab.</p>
        ) : (
          <ul className="grid gap-1">
            {dashboard.datasets.map((d) => {
              const used = dashboard.widgets.filter((w) => (isDataWidget(w) && w.binding.datasetId === d.id) || (w.type === "filter" && w.options.datasetId === d.id)).length;
              return (
                <li key={d.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
                  <DatabaseIcon className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate font-medium">{d.name}</span>
                  <span className="font-mono text-[10.5px] text-muted-foreground tabular">
                    {tables.get(d.id)?.rows.length ?? 0} rows · {used} widget{used === 1 ? "" : "s"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
