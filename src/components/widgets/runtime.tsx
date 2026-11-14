"use client";

import * as React from "react";
import type { Dashboard, FilterWidget, RawTable } from "@/lib/model/types";
import type { BindingIssue } from "@/lib/data/resolve";
import { findBindingIssues, resolveAll } from "@/lib/data/resolve";
import type { FilterState, FilterValue } from "@/lib/data/query";

export interface DashboardRuntime {
  dashboard: Dashboard;
  tables: Map<string, RawTable>;
  datasetNames: Map<string, string>;
  filters: FilterWidget[];
  filterState: FilterState;
  setFilter: (id: string, value: FilterValue) => void;
  issuesByWidget: Map<string, BindingIssue[]>;
  issues: BindingIssue[];
  mode: "edit" | "view";
  /** Opens the Data tab (builder only). */
  onRequestData?: () => void;
  /** Selects a widget and focuses its broken field (builder only). */
  onRepair?: (widgetId: string) => void;
}

const RuntimeContext = React.createContext<DashboardRuntime | null>(null);

export function useRuntime() {
  const ctx = React.useContext(RuntimeContext);
  if (!ctx) throw new Error("useRuntime must be used inside <DashboardRuntimeProvider>");
  return ctx;
}

export function useDashboardDerived(dashboard: Dashboard) {
  const tables = React.useMemo(
    () => resolveAll(dashboard),
    // Recompute only when data inputs change, not on layout/style edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboard.sources, dashboard.sourceData, dashboard.datasets],
  );
  const datasetNames = React.useMemo(() => new Map(dashboard.datasets.map((d) => [d.id, d.name])), [dashboard.datasets]);
  const issues = React.useMemo(() => findBindingIssues(dashboard.widgets, tables, datasetNames), [dashboard.widgets, tables, datasetNames]);
  const issuesByWidget = React.useMemo(() => {
    const m = new Map<string, BindingIssue[]>();
    for (const i of issues) m.set(i.widgetId, [...(m.get(i.widgetId) ?? []), i]);
    return m;
  }, [issues]);
  return { tables, datasetNames, issues, issuesByWidget };
}

export function DashboardRuntimeProvider({
  dashboard,
  mode,
  onRequestData,
  onRepair,
  children,
}: {
  dashboard: Dashboard;
  mode: "edit" | "view";
  onRequestData?: () => void;
  onRepair?: (widgetId: string) => void;
  children: React.ReactNode;
}) {
  const derived = useDashboardDerived(dashboard);
  const [filterState, setFilterState] = React.useState<FilterState>({});
  const setFilter = React.useCallback((id: string, value: FilterValue) => setFilterState((s) => ({ ...s, [id]: value })), []);
  const filters = React.useMemo(
    () => dashboard.widgets.filter((w): w is FilterWidget => w.type === "filter"),
    [dashboard.widgets],
  );
  const value = React.useMemo<DashboardRuntime>(
    () => ({ dashboard, ...derived, filters, filterState, setFilter, mode, onRequestData, onRepair }),
    [dashboard, derived, filters, filterState, setFilter, mode, onRequestData, onRepair],
  );
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function seriesColor(slot: number, palette: Dashboard["appearance"]["palette"] = "default") {
  if (palette === "monochrome") {
    const mix = [100, 70, 48, 32, 84, 58, 40, 24][(slot - 1) % 8];
    return `color-mix(in oklch, var(--foreground) ${mix}%, transparent)`;
  }
  return `var(--chart-${((slot - 1) % 8) + 1})`;
}

export function usePrefersReducedMotion() {
  return React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}
