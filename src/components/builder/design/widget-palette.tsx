"use client";

import * as React from "react";
import { BarChart3Icon, FilterIcon, HashIcon, LineChartIcon, PlusIcon, Table2Icon, TypeIcon } from "lucide-react";
import type { WidgetType } from "@/lib/model/types";
import { WIDGET_DESCRIPTIONS, WIDGET_LABELS } from "@/lib/model/defaults";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const WIDGET_ICONS: Record<WidgetType, React.ComponentType<{ className?: string }>> = {
  kpi: HashIcon,
  line: LineChartIcon,
  bar: BarChart3Icon,
  table: Table2Icon,
  text: TypeIcon,
  filter: FilterIcon,
};

export const WIDGET_ORDER: WidgetType[] = ["kpi", "line", "bar", "table", "text", "filter"];

export function WidgetPalette({ onAdd }: { onAdd: (type: WidgetType) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary" aria-haspopup="dialog">
          <PlusIcon /> Add widget
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1.5">
        <p className="px-2 pt-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Widgets</p>
        <div className="grid grid-cols-2 gap-1">
          {WIDGET_ORDER.map((t) => {
            const Icon = WIDGET_ICONS[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onAdd(t);
                  setOpen(false);
                }}
                className="flex flex-col items-start gap-1.5 rounded-md border border-transparent p-2.5 text-left transition-colors duration-150 hover:border-border hover:bg-muted focus-visible:border-border"
              >
                <span className="flex size-7 items-center justify-center rounded-md border border-border bg-surface shadow-surface">
                  <Icon className="size-3.5" />
                </span>
                <span className="text-[13px] font-medium">{WIDGET_LABELS[t]}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">{WIDGET_DESCRIPTIONS[t]}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
