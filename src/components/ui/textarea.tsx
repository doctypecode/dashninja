import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm shadow-surface outline-none placeholder:text-muted-foreground/80 transition-[border-color,box-shadow] duration-150",
        "focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/20 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
