"use client";
import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-5 w-8.5 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-150 outline-none data-[state=checked]:bg-primary data-[state=unchecked]:bg-input disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-surface shadow-sm ring-0 transition-transform duration-150 data-[state=checked]:translate-x-[15px] data-[state=unchecked]:translate-x-0.5 dark:data-[state=checked]:bg-primary-foreground" />
    </SwitchPrimitive.Root>
  );
}
