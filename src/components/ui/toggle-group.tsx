"use client";
import * as React from "react";
import { ToggleGroup as TG } from "radix-ui";
import { cn } from "@/lib/utils";

export function ToggleGroup({ className, ...props }: React.ComponentProps<typeof TG.Root>) {
  return (
    <TG.Root
      className={cn("inline-flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5", className)}
      {...props}
    />
  );
}

export function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof TG.Item>) {
  return (
    <TG.Item
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-[4px] px-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground data-[state=on]:bg-surface data-[state=on]:text-foreground data-[state=on]:shadow-surface disabled:opacity-50 [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}
