"use client";

import * as React from "react";
import { AlertCircleIcon, EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AuthCard({ title, description, children, footer }: { title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="w-full max-w-[380px] animate-fade-up">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-raised sm:p-7">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
  aside,
}: {
  id: string;
  label: string;
  error?: string | null;
  hint?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 text-xs text-destructive" role="alert">
          <AlertCircleIcon className="size-3.5 shrink-0" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordInput({ id, invalid, ...props }: React.ComponentProps<"input"> & { invalid?: boolean }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className="pr-10"
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}

export function FormAlert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" | "success" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2.5 text-[13px]",
        tone === "error" && "border-destructive/30 bg-destructive-muted text-destructive",
        tone === "info" && "border-border bg-muted text-foreground",
        tone === "success" && "border-success/30 bg-success-muted text-success",
      )}
    >
      {children}
    </div>
  );
}

export function SubmitButton({ pending, children, ...props }: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}

export function GoogleButton({ pending, onClick, disabled }: { pending: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" variant="secondary" className="w-full" onClick={onClick} disabled={pending || disabled} aria-busy={pending}>
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <GoogleGlyph />}
      Continue with Google
    </Button>
  );
}

export function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function DemoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-md border border-dashed border-border-strong bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
      <span className="mr-1.5 rounded-[4px] border border-border bg-surface px-1 py-px font-mono text-[10px] text-foreground uppercase">Demo</span>
      {children}
    </div>
  );
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(v: string) {
  if (!v.trim()) return "Enter your email address.";
  if (!EMAIL_RE.test(v.trim())) return "Enter a valid email address, like name@company.com.";
  return null;
}

export function validatePassword(v: string, mode: "signin" | "new") {
  if (!v) return mode === "signin" ? "Enter your password." : "Create a password.";
  if (mode === "new" && v.length < 8) return "Use at least 8 characters.";
  return null;
}
