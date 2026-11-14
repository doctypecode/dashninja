"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  CopyIcon,
  MonitorIcon,
  PanelRightOpenIcon,
  Redo2Icon,
  SmartphoneIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import type { Widget, WidgetType } from "@/lib/model/types";
import { createWidget, WIDGET_DEFAULT_SIZE, WIDGET_LABELS } from "@/lib/model/defaults";
import { applyLayout, clampRect, findFreeSlot, resolveLayout, useBuilder } from "@/lib/builder/store";
import { uid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DashboardView } from "@/components/widgets/dashboard-view";
import { cn } from "@/lib/utils";
import { Canvas } from "./canvas";
import { WidgetPalette } from "./widget-palette";
import { Inspector } from "./inspector";
import { useMediaQuery } from "@/lib/use-media-query";

function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}

export type RightPanel = "settings" | "transformations" | "source" | "chat" | null;

export function DesignTab({
  active,
  panel,
  onPanelChange,
  onAskAi,
}: {
  active: boolean;
  panel: RightPanel;
  onPanelChange: (p: RightPanel) => void;
  /** Select a widget and attach it to the chat's context. */
  onAskAi?: (id: string) => void;
}) {
  const b = useBuilder();
  const isDesktop = useIsDesktop();
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const canvasScrollRef = React.useRef<HTMLDivElement>(null);
  const appearance = b.draft.appearance;

  // The inspector appears when a widget is selected (desktop) — it never navigates away.
  // An open chat stays open, so cards can be picked and asked about one after another.
  const prevSelected = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (b.selectedId && b.selectedId !== prevSelected.current && isDesktop && panel !== "chat") {
      onPanelChange("settings");
    }
    prevSelected.current = b.selectedId;
  }, [b.selectedId, isDesktop, onPanelChange, panel]);

  // Repair requests from widgets or the Data tab: open the inspector on that widget.
  React.useEffect(() => {
    if (!b.repairId) return;
    if (isDesktop) {
      onPanelChange("settings");
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrawerOpen(true);
    }
    requestAnimationFrame(() => {
      document.querySelector(`[data-widget-id="${b.repairId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [b.repairId, isDesktop, onPanelChange]);

  const addWidget = React.useCallback(
    (type: WidgetType) => {
      const size = WIDGET_DEFAULT_SIZE[type];
      const at = findFreeSlot(b.draft.widgets, size.w, size.h);
      const datasetId = b.draft.datasets[0]?.id ?? null;
      const w = createWidget(type, at, type === "text" ? null : datasetId);
      b.update((d) => ({ ...d, widgets: [...d.widgets, w] }));
      b.select(w.id);
      setMessage(`Added ${WIDGET_LABELS[type]}`);
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-widget-id="${w.id}"]`);
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        el?.focus({ preventScroll: true });
      });
    },
    [b],
  );

  const duplicate = React.useCallback(
    (id: string) => {
      const src = b.draft.widgets.find((w) => w.id === id);
      if (!src) return;
      const copy = { ...structuredClone(src), id: uid("w"), title: src.title ? `${src.title} copy` : src.title } as Widget;
      const slot = findFreeSlot(b.draft.widgets, src.layout.w, src.layout.h);
      copy.layout = { ...src.layout, ...slot };
      b.update((d) => ({ ...d, widgets: [...d.widgets, copy] }));
      b.select(copy.id);
      setMessage(`Duplicated ${src.title || WIDGET_LABELS[src.type]}`);
    },
    [b],
  );

  const remove = React.useCallback(
    (id: string) => {
      const w = b.draft.widgets.find((x) => x.id === id);
      if (!w) return;
      b.update((d) => ({
        ...d,
        // Removing a filter also removes it from widgets that listened to it.
        widgets: d.widgets
          .filter((x) => x.id !== id)
          .map((x) =>
            "binding" in x && x.binding.filterIds.includes(id) ? { ...x, binding: { ...x.binding, filterIds: x.binding.filterIds.filter((f) => f !== id) } } : x,
          ),
      }));
      setMessage(`Deleted ${w.title || WIDGET_LABELS[w.type]}`);
      toast(`Deleted ${w.title || WIDGET_LABELS[w.type]}`, { action: { label: "Undo", onClick: () => b.undo() } });
    },
    [b],
  );

  // Canvas keyboard: arrows move, Shift+arrows resize, Delete, ⌘D, Esc.
  React.useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (target?.closest("[role=dialog], [role=menu], [role=listbox], [data-inspector]")) return;
      const sel = b.selected;
      if (e.key === "Escape" && sel) {
        b.select(null);
        return;
      }
      if (!sel) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate(sel.id);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove(sel.id);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key] as [number, number];
        const r = sel.layout;
        const next = clampRect(sel.type, e.shiftKey ? { ...r, w: r.w + d[0], h: r.h + d[1] } : { ...r, x: r.x + d[0], y: r.y + d[1] });
        if (next.x === r.x && next.y === r.y && next.w === r.w && next.h === r.h) return;
        const layout = resolveLayout(b.draft.widgets, sel.id, next);
        b.update((dash) => ({ ...dash, widgets: applyLayout(dash.widgets, layout) }), { coalesceKey: `kbd:${sel.id}` });
        setMessage(e.shiftKey ? `Size ${next.w} by ${next.h}` : `Column ${next.x + 1}, row ${next.y + 1}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, b, duplicate, remove]);

  const showInspectorPanel = isDesktop && panel === "settings";
  const bg = appearance.background;
  const maxW = appearance.maxWidth === "narrow" ? "max-w-4xl" : appearance.maxWidth === "wide" ? "max-w-7xl" : "max-w-none";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-surface px-2 py-1.5 sm:px-3">
        <WidgetPalette onAdd={addWidget} />
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
        <Hint label="Undo" shortcut="⌘Z">
          <Button variant="ghost" size="icon-sm" onClick={b.undo} disabled={!b.canUndo} aria-label="Undo">
            <Undo2Icon />
          </Button>
        </Hint>
        <Hint label="Redo" shortcut="⇧⌘Z">
          <Button variant="ghost" size="icon-sm" onClick={b.redo} disabled={!b.canRedo} aria-label="Redo">
            <Redo2Icon />
          </Button>
        </Hint>
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
        <ToggleGroup type="single" value={device} onValueChange={(v) => v && setDevice(v as typeof device)} aria-label="Canvas device">
          <Hint label="Desktop layout">
            <ToggleGroupItem value="desktop" aria-label="Desktop">
              <MonitorIcon />
            </ToggleGroupItem>
          </Hint>
          <Hint label="Mobile preview (stacked)">
            <ToggleGroupItem value="mobile" aria-label="Mobile">
              <SmartphoneIcon />
            </ToggleGroupItem>
          </Hint>
        </ToggleGroup>
        {b.selected ? (
          <>
            <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden />
            <span className="hidden max-w-40 truncate text-xs text-muted-foreground md:inline">
              {b.selected.title || WIDGET_LABELS[b.selected.type]}
            </span>
            <Hint label="Duplicate" shortcut="⌘D">
              <Button variant="ghost" size="icon-sm" onClick={() => duplicate(b.selected!.id)} aria-label="Duplicate selected widget">
                <CopyIcon />
              </Button>
            </Hint>
            <Hint label="Delete" shortcut="Del">
              <Button variant="ghost" size="icon-sm" onClick={() => remove(b.selected!.id)} aria-label="Delete selected widget">
                <Trash2Icon />
              </Button>
            </Hint>
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <span className="hidden font-mono text-[11px] text-muted-foreground xl:inline">
            {b.draft.widgets.length} widget{b.draft.widgets.length === 1 ? "" : "s"} · 12-col grid
          </span>
          {isDesktop ? null : (
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)}>
              <PanelRightOpenIcon /> {b.selected ? "Edit widget" : "Settings"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div
          ref={canvasScrollRef}
          className={cn("min-w-0 flex-1 overflow-auto", bg === "dots" && "bg-dots", bg === "grid" && "bg-grid")}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) b.select(null);
          }}
        >
          {device === "desktop" ? (
            <div
              className={cn("mx-auto px-4 pt-12 pb-16 sm:px-6", maxW, "min-w-[720px]")}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) b.select(null);
              }}
            >
              <Canvas
                onAdd={addWidget}
                onDuplicate={duplicate}
                onDelete={remove}
                announce={setMessage}
                onAskAi={
                  onAskAi
                    ? (id) => {
                        b.select(id);
                        onAskAi(id);
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="mx-auto max-w-[400px] px-4 py-6">
              <div className="mb-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                On phones, widgets stack in reading order. Arrange them in the desktop layout.
              </div>
              <div className="rounded-[20px] border border-border-strong bg-background p-3 shadow-raised">
                {b.draft.widgets.length ? (
                  <DashboardView dashboard={b.draft} forceStack />
                ) : (
                  <p className="py-16 text-center text-sm text-muted-foreground">No widgets yet</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Inspector: contextual panel, never global navigation */}
        {showInspectorPanel ? (
          <aside
            id="inspector"
            data-inspector
            aria-label={b.selected ? "Widget inspector" : "Dashboard settings"}
            className="w-[320px] shrink-0 overflow-y-auto border-l border-border bg-surface animate-in slide-in-from-right-2 fade-in-0 duration-200"
          >
            <Inspector onClose={() => onPanelChange(null)} />
          </aside>
        ) : null}
      </div>

      {!isDesktop ? (
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="p-0" data-inspector>
            <SheetTitle className="sr-only">{b.selected ? "Widget inspector" : "Dashboard settings"}</SheetTitle>
            <SheetDescription className="sr-only">Edit the selected widget or dashboard appearance</SheetDescription>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Inspector onClose={() => setDrawerOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {message}
      </div>
    </div>
  );
}
