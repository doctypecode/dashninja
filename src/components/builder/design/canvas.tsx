"use client";

import * as React from "react";
import { CopyIcon, DatabaseIcon, GripVerticalIcon, MessageSquarePlusIcon, Trash2Icon } from "lucide-react";
import type { GridRect, Widget, WidgetType } from "@/lib/model/types";
import { GRID_COLUMNS } from "@/lib/model/types";
import { WIDGET_LABELS } from "@/lib/model/defaults";
import { applyLayout, clampRect, resolveLayout, useBuilder } from "@/lib/builder/store";
import { WidgetRenderer } from "@/components/widgets/widget-renderer";
import { useRuntime } from "@/components/widgets/runtime";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WIDGET_ICONS, WIDGET_ORDER } from "./widget-palette";

interface Interaction {
  id: string;
  mode: "move" | "resize-e" | "resize-s" | "resize-se";
  startX: number;
  startY: number;
  orig: GridRect;
  preview: GridRect;
  dx: number;
  dy: number;
  started: boolean;
}

const DRAG_THRESHOLD = 4;

export function Canvas({
  onAdd,
  onDuplicate,
  onDelete,
  announce,
  onAskAi,
}: {
  onAdd: (type: WidgetType) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  announce: (msg: string) => void;
  onAskAi?: (id: string) => void;
}) {
  const b = useBuilder();
  const { onRequestData } = useRuntime();
  const { gap, rowHeight } = b.draft.appearance;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [drag, setDrag] = React.useState<Interaction | null>(null);
  const dragRef = React.useRef<Interaction | null>(null);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const colW = width > 0 ? (width - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS : 0;
  const stepX = colW + gap;
  const stepY = rowHeight + gap;

  const widgets = b.draft.widgets;
  const liveLayout = React.useMemo(() => {
    if (!drag?.started) return null;
    return resolveLayout(widgets, drag.id, drag.preview);
  }, [drag, widgets]);

  const rectFor = (w: Widget) => liveLayout?.get(w.id) ?? w.layout;
  const px = (r: GridRect) => ({
    left: r.x * stepX,
    top: r.y * stepY,
    width: r.w * colW + (r.w - 1) * gap,
    height: r.h * rowHeight + (r.h - 1) * gap,
  });

  const rows = Math.max(
    16,
    ...widgets.map((w) => {
      const r = rectFor(w);
      return r.y + r.h;
    }),
  ) + 4;

  function onPointerDown(e: React.PointerEvent, w: Widget, mode: Interaction["mode"]) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (mode === "move" && target.closest("button, a, input, textarea, select, [role=combobox], [data-no-drag]")) {
      b.select(w.id);
      return;
    }
    e.stopPropagation();
    b.select(w.id);
    // Resizes capture right away. Moves capture only once the pointer travels past the
    // threshold, so a plain click still reaches the chart (drill-down, toggles).
    if (mode !== "move") (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const next: Interaction = { id: w.id, mode, startX: e.clientX, startY: e.clientY, orig: w.layout, preview: w.layout, dx: 0, dy: 0, started: mode !== "move" };
    dragRef.current = next;
    setDrag(next);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || stepX === 0) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const started = d.started || Math.hypot(dx, dy) > DRAG_THRESHOLD;
    if (!started) return;
    if (!d.started) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const w = widgets.find((x) => x.id === d.id);
    if (!w) return;
    const cx = Math.round(dx / stepX);
    const cy = Math.round(dy / stepY);
    let r: GridRect = d.orig;
    if (d.mode === "move") r = { ...d.orig, x: d.orig.x + cx, y: d.orig.y + cy };
    if (d.mode === "resize-e" || d.mode === "resize-se") r = { ...r, w: d.orig.w + cx };
    if (d.mode === "resize-s" || d.mode === "resize-se") r = { ...r, h: d.orig.h + cy };
    if (d.mode !== "move" && d.orig.x + r.w > GRID_COLUMNS) r = { ...r, w: GRID_COLUMNS - d.orig.x };
    const preview = clampRect(w.type, r);
    const next = { ...d, dx, dy, started, preview };
    dragRef.current = next;
    setDrag(next);
  }

  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || !d.started) return;
    const o = d.orig;
    const p = d.preview;
    if (o.x === p.x && o.y === p.y && o.w === p.w && o.h === p.h) return;
    const layout = resolveLayout(widgets, d.id, p);
    b.update((dash) => ({ ...dash, widgets: applyLayout(dash.widgets, layout) }));
    const w = widgets.find((x) => x.id === d.id);
    announce(
      d.mode === "move"
        ? `Moved ${w?.title || "widget"} to column ${p.x + 1}, row ${p.y + 1}`
        : `Resized ${w?.title || "widget"} to ${p.w} by ${p.h}`,
    );
  }

  // Alignment guides: edges of the dragged widget that line up with other widgets.
  const guides = React.useMemo(() => {
    if (!drag?.started || !liveLayout) return { v: [] as number[], h: [] as number[] };
    const p = drag.preview;
    const v = new Set<number>();
    const h = new Set<number>();
    for (const w of widgets) {
      if (w.id === drag.id) continue;
      const r = liveLayout.get(w.id) ?? w.layout;
      for (const edge of [r.x, r.x + r.w]) if (edge === p.x || edge === p.x + p.w) v.add(edge);
      for (const edge of [r.y, r.y + r.h]) if (edge === p.y || edge === p.y + p.h) h.add(edge);
    }
    return { v: [...v], h: [...h] };
  }, [drag, liveLayout, widgets]);

  if (widgets.length === 0) {
    return (
      <div ref={containerRef} className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-lg rounded-xl border border-dashed border-border-strong bg-surface/80 p-8 text-center shadow-surface">
          <h2 className="text-base font-medium tracking-tight">Start your dashboard</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Add a widget to the canvas. {b.draft.datasets.length === 0 ? "Connect data in the Data tab to bind charts and KPIs." : "Bind it to a dataset in the inspector."}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {WIDGET_ORDER.map((t) => {
              const Icon = WIDGET_ICONS[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onAdd(t)}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-3 text-xs transition-colors duration-150 hover:border-border-strong hover:bg-muted"
                >
                  <Icon className="size-4" />
                  {WIDGET_LABELS[t]}
                </button>
              );
            })}
          </div>
          {b.draft.datasets.length === 0 && onRequestData ? (
            <Button variant="link" size="sm" className="mt-4" onClick={onRequestData}>
              <DatabaseIcon /> Connect data first
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative select-none"
      style={{ height: rows * stepY - gap }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) b.select(null);
      }}
    >
      {/* Column guides while dragging */}
      {drag?.started ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 animate-fade-in">
          {Array.from({ length: GRID_COLUMNS }, (_, i) => (
            <div key={i} className="absolute inset-y-0 rounded-sm bg-focus/[0.04] outline outline-1 -outline-offset-1 outline-focus/10" style={{ left: i * stepX, width: colW }} />
          ))}
          {guides.v.map((x) => (
            <div key={`v${x}`} className="absolute inset-y-0 w-px bg-focus/60" style={{ left: x === 0 ? 0 : x * stepX - gap / 2 }} />
          ))}
          {guides.h.map((y) => (
            <div key={`h${y}`} className="absolute inset-x-0 h-px bg-focus/60" style={{ top: y === 0 ? 0 : y * stepY - gap / 2 }} />
          ))}
        </div>
      ) : null}

      {/* Snap placeholder */}
      {drag?.started ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-lg border-2 border-dashed border-focus/60 bg-focus/[0.06] transition-[left,top,width,height] duration-120"
          style={px(drag.preview)}
        />
      ) : null}

      {widgets.map((w) => {
        const r = rectFor(w);
        const isDragging = drag?.started && drag.id === w.id;
        const selected = b.selectedId === w.id;
        const pos = isDragging && drag.mode === "move" ? { ...px(drag.orig), transform: `translate(${drag.dx}px, ${drag.dy}px)` } : isDragging ? px(drag.preview) : px(r);
        return (
          <div
            key={w.id}
            data-widget-id={w.id}
            role="group"
            tabIndex={0}
            aria-label={`${WIDGET_LABELS[w.type]}${w.title ? `: ${w.title}` : ""}. ${selected ? "Selected. Arrow keys move, Shift+Arrow resizes, Delete removes." : "Press Enter to select."}`}
            onPointerDown={(e) => onPointerDown(e, w, "move")}
            onFocus={(e) => {
              if (e.target === e.currentTarget && !selected) b.select(w.id);
            }}
            className={cn(
              "group/widget absolute rounded-lg outline-none",
              !isDragging && "transition-[left,top,width,height] duration-150 ease-out",
              isDragging ? "z-20 cursor-grabbing opacity-90 shadow-raised" : "cursor-grab",
              selected ? "z-10 ring-2 ring-focus ring-offset-2 ring-offset-background" : "hover:ring-1 hover:ring-border-strong focus-visible:ring-2 focus-visible:ring-focus/60",
            )}
            style={pos}
          >
            <div className="pointer-events-auto h-full">
              <WidgetRenderer widget={w} />
            </div>
            {onAskAi && !drag?.started ? (
              <button
                type="button"
                data-no-drag
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onAskAi(w.id);
                  announce(`${w.title || WIDGET_LABELS[w.type]} added to the chat.`);
                }}
                title="Ask AI about this widget"
                aria-label={`Ask AI about ${w.title || WIDGET_LABELS[w.type]}`}
                className={cn(
                  "absolute top-1.5 right-1.5 z-20 grid size-6 place-items-center rounded-md border border-border bg-surface/95 text-muted-foreground shadow-sm transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60",
                  selected ? "opacity-100" : "opacity-0 group-hover/widget:opacity-100 group-focus-within/widget:opacity-100",
                )}
              >
                <MessageSquarePlusIcon className="size-3.5" aria-hidden />
              </button>
            ) : null}
            {selected && !drag?.started ? (
              <>
                <div className="absolute -top-8 left-0 z-20 flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5 shadow-raised" data-no-drag>
                  <span className="flex items-center gap-1 px-1.5 text-[11px] font-medium text-muted-foreground">
                    <GripVerticalIcon className="size-3" aria-hidden /> {WIDGET_LABELS[w.type]}
                    <span className="font-mono text-[10px]">
                      {w.layout.w}×{w.layout.h}
                    </span>
                  </span>
                  <Button variant="ghost" size="icon-xs" onClick={() => onDuplicate(w.id)} aria-label="Duplicate widget">
                    <CopyIcon />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => onDelete(w.id)} aria-label="Delete widget" className="hover:text-destructive">
                    <Trash2Icon />
                  </Button>
                </div>
                <ResizeHandle className="top-1/2 -right-1.5 h-6 w-2 -translate-y-1/2 cursor-ew-resize" onPointerDown={(e) => onPointerDown(e, w, "resize-e")} />
                <ResizeHandle className="-bottom-1.5 left-1/2 h-2 w-6 -translate-x-1/2 cursor-ns-resize" onPointerDown={(e) => onPointerDown(e, w, "resize-s")} />
                <ResizeHandle className="-right-1.5 -bottom-1.5 size-3 cursor-nwse-resize" onPointerDown={(e) => onPointerDown(e, w, "resize-se")} />
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ResizeHandle({ className, onPointerDown }: { className: string; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      aria-hidden
      onPointerDown={onPointerDown}
      className={cn("absolute z-20 rounded-[3px] border border-focus bg-surface shadow-sm touch-none", className)}
    />
  );
}
