"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, CheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AuthError, useAuthAdapter } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  AuthCard,
  DemoNote,
  Divider,
  Field,
  FormAlert,
  GoogleButton,
  PasswordInput,
  SubmitButton,
  validateEmail,
  validatePassword,
} from "./auth-ui";
import { useNextParam, useRedirectIfSignedIn } from "./use-redirect-if-signed-in";

export function SignUpForm() {
  useRedirectIfSignedIn();
  const auth = useAuthAdapter();
  const router = useRouter();
  const next = useNextParam();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [pending, setPending] = React.useState<"password" | "google" | null>(null);
  const [error, setError] = React.useState<AuthError | null>(null);

  const show = (k: string) => touched[k] || submitted;
  const nameError = show("name") && !name.trim() ? "Enter your name." : null;
  const emailError = show("email") ? validateEmail(email) || (error?.field === "email" ? error.message : null) : null;
  const passwordError = show("password") ? validatePassword(password, "new") : null;
  const nextQuery = next !== "/workspace" ? `?next=${encodeURIComponent(next)}` : "";

  const checks = [
    { ok: password.length >= 8, label: "8+ characters" },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), label: "Letters and numbers" },
  ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (!name.trim() || validateEmail(email) || validatePassword(password, "new")) return;
    setPending("password");
    try {
      const res = await auth.signUp({ name, email, password });
      const q = new URLSearchParams({ email: res.email });
      if (res.verificationToken) q.set("demo", res.verificationToken);
      if (next !== "/workspace") q.set("next", next);
      router.push(`/verify-email?${q.toString()}`);
    } catch (err) {
      setError(err instanceof AuthError ? err : new AuthError("network", "Something went wrong. Try again."));
      setPending(null);
    }
  }

  async function onGoogle() {
    setPending("google");
    setError(null);
    try {
      await auth.signInWithGoogle();
      router.replace(next);
    } catch {
      setError(new AuthError("network", "Google sign-in was cancelled or failed."));
      setPending(null);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      description="Start with sample data or a blank dashboard."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/sign-in${nextQuery}`} className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton pending={pending === "google"} disabled={pending === "password"} onClick={onGoogle} />
      <Divider />
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {error && !error.field ? (
          <FormAlert>
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error.message}
          </FormAlert>
        ) : null}
        <Field id="name" label="Name" error={nameError}>
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            aria-invalid={Boolean(nameError) || undefined}
            disabled={pending !== null}
          />
        </Field>
        <Field
          id="email"
          label="Email"
          error={emailError}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error?.field === "email") setError(null);
            }}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            aria-invalid={Boolean(emailError) || undefined}
            aria-describedby={emailError ? "email-error" : undefined}
            disabled={pending !== null}
          />
        </Field>
        {error?.code === "email_taken" ? (
          <p className="-mt-2 text-xs text-muted-foreground">
            <Link href={`/sign-in${nextQuery}`} className="underline underline-offset-2">
              Sign in instead
            </Link>{" "}
            or{" "}
            <Link href={`/forgot-password?email=${encodeURIComponent(email)}`} className="underline underline-offset-2">
              reset your password
            </Link>
            .
          </p>
        ) : null}
        <Field id="password" label="Password" error={passwordError}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            invalid={Boolean(passwordError)}
            disabled={pending !== null}
          />
        </Field>
        <ul className="-mt-2 flex gap-4 text-xs" aria-label="Password requirements">
          {checks.map((c) => (
            <li key={c.label} className={cn("flex items-center gap-1 transition-colors", c.ok ? "text-success" : "text-muted-foreground")}>
              <CheckIcon className={cn("size-3.5", !c.ok && "opacity-40")} aria-hidden />
              {c.label}
              <span className="sr-only">{c.ok ? "(met)" : "(not met)"}</span>
            </li>
          ))}
        </ul>
        <SubmitButton pending={pending === "password"} disabled={pending === "google"}>
          {pending === "password" ? "Creating account…" : "Create account"}
        </SubmitButton>
      </form>
      <DemoNote>No email is sent. After signing up you’ll get a demo verification link on screen.</DemoNote>
    </AuthCard>
  );
}
