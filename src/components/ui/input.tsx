import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground shadow-surface transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-muted-foreground/80",
        "focus-visible:border-focus focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus/20",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/15",
        "disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}
