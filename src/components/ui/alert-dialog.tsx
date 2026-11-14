"use client";
import * as React from "react";
import { AlertDialog as AD } from "radix-ui";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export const AlertDialog = AD.Root;
export const AlertDialogTrigger = AD.Trigger;

export function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AD.Content>) {
  return (
    <AD.Portal>
      <AD.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150" />
      <AD.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-surface p-5 shadow-raised",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] duration-200",
          className,
        )}
        {...props}
      />
    </AD.Portal>
  );
}
export function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}
export function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}
export function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AD.Title>) {
  return <AD.Title className={cn("text-base font-semibold tracking-tight", className)} {...props} />;
}
export function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AD.Description>) {
  return <AD.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
export function AlertDialogAction({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof AD.Action> & { variant?: "default" | "destructive" }) {
  return <AD.Action className={cn(buttonVariants({ variant }), className)} {...props} />;
}
export function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AD.Cancel>) {
  return <AD.Cancel className={cn(buttonVariants({ variant: "secondary" }), className)} {...props} />;
}
