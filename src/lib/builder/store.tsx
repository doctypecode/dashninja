"use client";

import * as React from "react";
import type { Dashboard, DataWidget, GridRect, Widget } from "@/lib/model/types";
import type { CellValue } from "@/lib/model/types";
import { GRID_COLUMNS } from "@/lib/model/types";
import { WIDGET_MIN_SIZE } from "@/lib/model/defaults";

/**
 * Builder draft store. Design and Data both edit this single draft, so
 * switching tabs never loses unsaved work. History snapshots are whole
 * dashboards (cheap: structural sharing, rows are never copied).
 */

const HISTORY_LIMIT = 100;
const COALESCE_MS = 900;

export type SaveStatus = "saved" | "unsaved" | "saving" | "failed";

interface State {
  draft: Dashboard;
  past: Dashboard[];
  future: Dashboard[];
  coalesce: { key: string; at: number } | null;
  revision: number;
  savedRevision: number;
  saving: boolean;
  saveError: string | null;
  selectedId: string | null;
  /** Widget whose broken binding the inspector should focus. */
  repairId: string | null;
}

type Action =
  | { type: "update"; recipe: (d: Dashboard) => Dashboard; coalesceKey?: string; skipHistory?: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; id: string | null }
  | { type: "repair"; id: string | null }
  | { type: "save-start" }
  | { type: "save-success"; revision: number; updatedAt: string }
  | { type: "save-failure"; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "update": {
      const next = action.recipe(state.draft);
      if (next === state.draft) return state;
      const now = Date.now();
      const merge =
        action.skipHistory ||
        (action.coalesceKey && state.coalesce?.key === action.coalesceKey && now - state.coalesce.at < COALESCE_MS);
      return {
        ...state,
        draft: next,
        past: merge ? state.past : [...state.past.slice(-HISTORY_LIMIT + 1), state.draft],
        future: action.skipHistory ? state.future : [],
        coalesce: action.coalesceKey ? { key: action.coalesceKey, at: now } : null,
        revision: state.revision + 1,
        selectedId: state.selectedId && next.widgets.some((w) => w.id === state.selectedId) ? state.selectedId : null,
      };
    }
    case "undo": {
      const prev = state.past.at(-1);
      if (!prev) return state;
      return {
        ...state,
        draft: prev,
        past: state.past.slice(0, -1),
        future: [state.draft, ...state.future],
        coalesce: null,
        revision: state.revision + 1,
        selectedId: state.selectedId && prev.widgets.some((w) => w.id === state.selectedId) ? state.selectedId : null,
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        draft: next,
        past: [...state.past, state.draft],
        future: state.future.slice(1),
        coalesce: null,
        revision: state.revision + 1,
      };
    }
    case "select":
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id, coalesce: null };
    case "repair":
      return { ...state, repairId: action.id, selectedId: action.id ?? state.selectedId };
    case "save-start":
      return { ...state, saving: true, saveError: null };
    case "save-success":
      return {
        ...state,
        saving: false,
        saveError: null,
        savedRevision: action.revision,
        // Keep the server timestamp without creating an undo step or a new revision.
        draft: state.revision === action.revision ? { ...state.draft, updatedAt: action.updatedAt } : state.draft,
      };
    case "save-failure":
      return { ...state, saving: false, saveError: action.message };
  }
}

export interface ImportCacheEntry {
  kind: "csv" | "excel";
  text?: string;
  sheets?: { name: string; matrix: CellValue[][] }[];
}

export interface BuilderApi {
  draft: Dashboard;
  revision: number;
  savedRevision: number;
  status: SaveStatus;
  saveError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  selectedId: string | null;
  selected: Widget | null;
  repairId: string | null;
  update: (recipe: (d: Dashboard) => Dashboard, opts?: { coalesceKey?: string; skipHistory?: boolean }) => void;
  updateWidget: (id: string, recipe: (w: Widget) => Widget, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  requestRepair: (id: string | null) => void;
  markSaving: () => number;
  markSaved: (revision: number, updatedAt: string) => void;
  markFailed: (message: string) => void;
  /** Session-only cache of raw file contents so parse settings can be changed after import. */
  importCache: React.RefObject<Map<string, ImportCacheEntry>>;
}

const BuilderContext = React.createContext<BuilderApi | null>(null);

export function BuilderProvider({ initial, children }: { initial: Dashboard; children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, undefined, () => ({
    draft: initial,
    past: [],
    future: [],
    coalesce: null,
    revision: 0,
    savedRevision: 0,
    saving: false,
    saveError: null,
    selectedId: null,
    repairId: null,
  }));
  const importCache = React.useRef(new Map<string, ImportCacheEntry>());

  const api = React.useMemo<BuilderApi>(() => {
    const status: SaveStatus = state.saving
      ? "saving"
      : state.saveError
        ? "failed"
        : state.revision !== state.savedRevision
          ? "unsaved"
          : "saved";
    return {
      draft: state.draft,
      revision: state.revision,
      savedRevision: state.savedRevision,
      status,
      saveError: state.saveError,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      selectedId: state.selectedId,
      selected: state.draft.widgets.find((w) => w.id === state.selectedId) ?? null,
      repairId: state.repairId,
      update: (recipe, opts) => dispatch({ type: "update", recipe, ...opts }),
      updateWidget: (id, recipe, coalesceKey) =>
        dispatch({
          type: "update",
          coalesceKey: coalesceKey ? `${id}:${coalesceKey}` : undefined,
          recipe: (d) => ({ ...d, widgets: d.widgets.map((w) => (w.id === id ? recipe(w) : w)) }),
        }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      select: (id) => dispatch({ type: "select", id }),
      requestRepair: (id) => dispatch({ type: "repair", id }),
      markSaving: () => {
        dispatch({ type: "save-start" });
        return state.revision;
      },
      markSaved: (revision, updatedAt) => dispatch({ type: "save-success", revision, updatedAt }),
      markFailed: (message) => dispatch({ type: "save-failure", message }),
      importCache,
    };
  }, [state]);

  return <BuilderContext.Provider value={api}>{children}</BuilderContext.Provider>;
}

export function useBuilder() {
  const ctx = React.useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder must be used inside <BuilderProvider>");
  return ctx;
}

// ---------- Layout helpers ----------

export function overlaps(a: GridRect, b: GridRect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Place `rect` for widget `id` and push any overlapping widgets straight down. */
export function resolveLayout(widgets: Widget[], id: string, rect: GridRect): Map<string, GridRect> {
  const out = new Map<string, GridRect>([[id, rect]]);
  const placed: GridRect[] = [rect];
  const others = widgets
    .filter((w) => w.id !== id)
    .sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
  for (const o of others) {
    const r = { ...o.layout };
    let moved = true;
    while (moved) {
      moved = false;
      for (const p of placed) {
        if (overlaps(r, p)) {
          r.y = p.y + p.h;
          moved = true;
        }
      }
    }
    placed.push(r);
    out.set(o.id, r);
  }
  return out;
}

export function applyLayout(widgets: Widget[], layout: Map<string, GridRect>): Widget[] {
  return widgets.map((w) => {
    const r = layout.get(w.id);
    return r && (r.x !== w.layout.x || r.y !== w.layout.y || r.w !== w.layout.w || r.h !== w.layout.h) ? { ...w, layout: r } : w;
  });
}

export function clampRect(type: Widget["type"], r: GridRect): GridRect {
  const min = WIDGET_MIN_SIZE[type];
  const w = Math.max(min.w, Math.min(GRID_COLUMNS, r.w));
  const h = Math.max(min.h, r.h);
  return { w, h, x: Math.max(0, Math.min(GRID_COLUMNS - w, r.x)), y: Math.max(0, r.y) };
}

/** First free slot scanning top-to-bottom, left-to-right. */
export function findFreeSlot(widgets: Widget[], w: number, h: number): { x: number; y: number } {
  const bottom = widgets.reduce((m, x) => Math.max(m, x.layout.y + x.layout.h), 0);
  for (let y = 0; y <= bottom; y++) {
    for (let x = 0; x <= GRID_COLUMNS - w; x++) {
      const r = { x, y, w, h };
      if (!widgets.some((o) => overlaps(r, o.layout))) return { x, y };
    }
  }
  return { x: 0, y: bottom };
}

export function isDataBound(w: Widget): w is DataWidget {
  return w.type === "kpi" || w.type === "line" || w.type === "bar" || w.type === "table";
}
