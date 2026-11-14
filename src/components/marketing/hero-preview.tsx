"use client";

import * as React from "react";
import type { Dashboard, Widget } from "@/lib/model/types";
import { createSampleDashboard } from "@/lib/model/sample-dashboard";
import { DashboardRuntimeProvider } from "@/components/widgets/runtime";
import { WidgetRenderer } from "@/components/widgets/widget-renderer";
import { Badge } from "@/components/ui/badge";
import { LogoMark } from "@/components/brand/logo";

const NOW = "2026-11-01T00:00:00.000Z";

/**
 * Landing-page product preview. Renders the real sample dashboard widgets
 * (same data engine as the app) in a fixed composition.
 */
export function HeroPreview() {
  const dashboard = React.useMemo<Dashboard>(() => createSampleDashboard("preview", "preview", NOW), []);
  const byId = React.useMemo(() => new Map(dashboard.widgets.map((w) => [w.id, w])), [dashboard]);
  const get = (id: string) => byId.get(id) as Widget;

  return (
    <DashboardRuntimeProvider dashboard={dashboard} mode="view">
      <div className="overflow-hidden rounded-xl border border-border bg-background shadow-raised">
        <div className="flex h-10 items-center gap-3 border-b border-border bg-surface px-3">
          <LogoMark className="size-4" />
          <span className="truncate text-[13px] font-medium">Sales overview</span>
          <Badge variant="outline" className="hidden sm:inline-flex">
            Sample · synthetic data
          </Badge>
          <div className="ml-auto hidden items-center gap-0.5 rounded-md border border-border bg-muted p-0.5 text-xs sm:flex" aria-hidden>
            <span className="rounded-[4px] bg-surface px-2 py-0.5 font-medium shadow-surface">Design</span>
            <span className="px-2 py-0.5 text-muted-foreground">Data</span>
          </div>
        </div>
        <div className="grid gap-3 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-[60px]">
              <WidgetRenderer widget={get("w_filter_region")} />
            </div>
            <div className="h-[60px]">
              <WidgetRenderer widget={get("w_filter_date")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {["w_kpi_revenue", "w_kpi_orders", "w_kpi_margin", "w_kpi_aov"].map((id) => (
              <div key={id} className="h-[118px]">
                <WidgetRenderer widget={get(id)} />
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-5">
            <div className="h-[260px] lg:col-span-3">
              <WidgetRenderer widget={get("w_line_revenue")} />
            </div>
            <div className="h-[260px] lg:col-span-2">
              <WidgetRenderer widget={get("w_bar_region")} />
            </div>
          </div>
        </div>
      </div>
    </DashboardRuntimeProvider>
  );
}
