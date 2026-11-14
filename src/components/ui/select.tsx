"use client";
import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  size = "default",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & { size?: "default" | "sm" }) {
  return (
    <SelectPrimitive.Trigger
      data-size={size}
      className={cn(
        "flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-surface px-2.5 text-sm shadow-surface outline-none transition-[border-color,box-shadow] duration-150 data-[placeholder]:text-muted-foreground",
        "focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/20 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
        "data-[size=default]:h-9 data-[size=sm]:h-8 data-[size=sm]:text-[13px] [&>span]:truncate [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          "relative z-50 max-h-(--radix-select-content-available-height) min-w-32 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-raised data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-150",
          position === "popper" && "w-full min-w-(--radix-select-trigger-width) data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="max-h-72 p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn("px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground", className)}
      {...props}
    />
  );
}

export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-2 rounded-[5px] py-1.5 pr-8 pl-2 text-[13px] outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}
