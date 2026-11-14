"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthError, useAuthAdapter } from "@/lib/auth";
import { AuthCard, Field, FormAlert, PasswordInput, SubmitButton, validatePassword } from "./auth-ui";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const auth = useAuthAdapter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const pwError = submitted ? validatePassword(password, "new") : null;
  const confirmError = submitted && confirm !== password ? "Passwords don’t match." : null;

  if (!token) {
    return (
      <AuthCard title="Reset link missing" footer={<Link href="/sign-in" className="underline-offset-4 hover:underline">Back to sign in</Link>}>
        <FormAlert>
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> This page needs the link from your reset email.
        </FormAlert>
        <Button asChild variant="secondary" className="mt-4 w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <FormAlert tone="success">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden /> You can now sign in with your new password.
        </FormAlert>
        <Button asChild className="mt-5 w-full">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (validatePassword(password, "new") || confirm !== password) return;
    setPending(true);
    try {
      await auth.resetPassword({ token: token!, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Couldn’t reset the password. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard title="Choose a new password" footer={<Link href="/sign-in" className="underline-offset-4 hover:underline">Back to sign in</Link>}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {error ? (
          <FormAlert>
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {error}{" "}
              <Link href="/forgot-password" className="font-medium underline underline-offset-2">
                Request a new link
              </Link>
            </span>
          </FormAlert>
        ) : null}
        <Field id="password" label="New password" error={pwError} hint="At least 8 characters.">
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={Boolean(pwError)} disabled={pending} />
        </Field>
        <Field id="confirm" label="Confirm password" error={confirmError}>
          <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={Boolean(confirmError)} disabled={pending} />
        </Field>
        <SubmitButton pending={pending}>{pending ? "Updating…" : "Update password"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
