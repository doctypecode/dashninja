"use client";

import * as React from "react";
import { InfoIcon, Settings2Icon, SparklesIcon, WorkflowIcon } from "lucide-react";
import { useBuilder } from "@/lib/builder/store";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RightPanel } from "./design/design-tab";

/**
 * Thin right-hand rail for builder panels. Design: dashboard settings and chat.
 * Data: transformations, source details and chat. One panel is open at a time;
 * selecting a widget still opens its inspector in the settings panel.
 */
export function BuilderRail({ tab, panel, onPanelChange }: { tab: "design" | "data"; panel: RightPanel; onPanelChange: (p: RightPanel) => void }) {
  const b = useBuilder();
  const items = [
    ...(tab === "design"
      ? [
          {
            id: "settings" as const,
            label: b.selected ? "Widget settings" : "Dashboard settings",
            icon: Settings2Icon,
          },
        ]
      : [
          { id: "transformations" as const, label: "Transformations", icon: WorkflowIcon },
          { id: "source" as const, label: "Source details", icon: InfoIcon },
        ]),
    { id: "chat" as const, label: "Data assistant", icon: SparklesIcon },
  ];
  return (
    <nav aria-label="Builder panels" className="flex w-12 shrink-0 flex-col items-center gap-1 border-l border-border bg-surface py-2">
      {items.map((item) => {
        const active = panel === item.id;
        const Icon = item.icon;
        return (
          <Hint key={item.id} label={active ? `Hide ${item.label.toLowerCase()}` : item.label} side="left">
            <button
              type="button"
              onClick={() => onPanelChange(active ? null : item.id)}
              aria-pressed={active}
              aria-label={item.label}
              className={cn(
                "relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active && "bg-muted text-foreground",
              )}
            >
              <Icon className="size-4" />
              {active ? <span aria-hidden className="absolute top-1.5 -left-2 h-5 w-0.5 rounded-full bg-foreground" /> : null}
            </button>
          </Hint>
        );
      })}
    </nav>
  );
}
