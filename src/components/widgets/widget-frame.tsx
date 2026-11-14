import * as React from "react";
import type { Widget } from "@/lib/model/types";
import { cn } from "@/lib/utils";

const PADDING = { compact: "p-2.5", normal: "p-3.5", relaxed: "p-5" } as const;
const TITLE = { sm: "text-[13px]", md: "text-sm", lg: "text-base" } as const;

export function WidgetFrame({
  widget,
  children,
  className,
  actions,
  hideHeader,
}: {
  widget: Widget;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  hideHeader?: boolean;
}) {
  const s = widget.style;
  const showHeader = !hideHeader && (widget.title || widget.description || actions);
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg",
        s.background === "surface" && "bg-surface",
        s.background === "muted" && "bg-muted",
        s.background === "transparent" && "bg-transparent",
        s.border === "default" && "border border-border",
        s.border === "strong" && "border border-border-strong",
        s.border === "none" && "border border-transparent",
        s.background !== "transparent" && s.border !== "none" && "shadow-surface",
        PADDING[s.padding],
        s.align === "center" && "text-center",
        className,
      )}
    >
      {showHeader ? (
        <div className={cn("mb-2 flex min-w-0 items-start gap-2", s.align === "center" && "justify-center")}>
          <div className="min-w-0 flex-1">
            {widget.title ? (
              <h3 className={cn("truncate font-medium tracking-tight text-foreground", TITLE[s.titleSize])}>{widget.title}</h3>
            ) : null}
            {widget.description ? (
              <p className="truncate text-xs text-muted-foreground">{widget.description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}
