import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 h-5 text-[11px] font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-foreground",
        outline: "border-border text-muted-foreground",
        solid: "border-transparent bg-primary text-primary-foreground",
        success: "border-success/30 bg-success-muted text-success",
        warning: "border-warning/30 bg-warning-muted text-warning",
        destructive: "border-destructive/30 bg-destructive-muted text-destructive",
        info: "border-info/30 bg-info-muted text-info",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
