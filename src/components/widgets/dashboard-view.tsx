"use client";

import * as React from "react";
import type { Dashboard } from "@/lib/model/types";
import { cn } from "@/lib/utils";
import { WidgetRenderer } from "./widget-renderer";

/**
 * Read-only dashboard layout used by Preview mode, the /sample viewer and
 * the mobile preview. Desktop uses the 12-column grid; narrow containers stack
 * widgets in reading order (top-to-bottom, left-to-right).
 */
export function DashboardView({ dashboard, forceStack, className }: { dashboard: Dashboard; forceStack?: boolean; className?: string }) {
  const { gap, rowHeight } = dashboard.appearance;
  const ordered = React.useMemo(
    () => [...dashboard.widgets].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x),
    [dashboard.widgets],
  );
  return (
    <div className={cn("@container w-full", className)}>
      <div
        className={cn("grid", forceStack ? "grid-cols-1" : "grid-cols-1 @3xl:grid-cols-12")}
        style={{ gap, gridAutoRows: rowHeight }}
      >
        {ordered.map((w) => (
          <div
            key={w.id}
            className="min-w-0 [grid-column:var(--col-sm)] [grid-row:var(--row-sm)] @3xl:[grid-column:var(--col)] @3xl:[grid-row:var(--row)]"
            style={
              {
                "--col": forceStack ? "1 / -1" : `${w.layout.x + 1} / span ${w.layout.w}`,
                "--row": forceStack ? `span ${mobileRows(w.type, w.layout.h)}` : `${w.layout.y + 1} / span ${w.layout.h}`,
                "--col-sm": "1 / -1",
                "--row-sm": `span ${mobileRows(w.type, w.layout.h)}`,
              } as React.CSSProperties
            }
          >
            <WidgetRenderer widget={w} />
          </div>
        ))}
      </div>
    </div>
  );
}

function mobileRows(type: string, h: number) {
  if (type === "kpi") return 4;
  if (type === "filter") return 2;
  if (type === "text") return Math.min(h, 3);
  return Math.max(8, Math.min(h, 10));
}
