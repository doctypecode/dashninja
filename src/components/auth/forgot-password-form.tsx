"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuthAdapter } from "@/lib/auth";
import { AuthCard, DemoNote, Field, FormAlert, SubmitButton, validateEmail } from "./auth-ui";

export function ForgotPasswordForm() {
  const params = useSearchParams();
  const auth = useAuthAdapter();
  const [email, setEmail] = React.useState(params.get("email") ?? "");
  const [submitted, setSubmitted] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState<{ token?: string } | null>(null);
  const error = submitted ? validateEmail(email) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (validateEmail(email)) return;
    setPending(true);
    const res = await auth.requestPasswordReset(email);
    setSent({ token: res.resetToken });
    setPending(false);
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account email and we’ll send a reset link."
      footer={<Link href="/sign-in" className="underline-offset-4 hover:underline">Back to sign in</Link>}
    >
      {sent ? (
        <>
          <FormAlert tone="info">
            <MailCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              If an account exists for <strong className="font-medium">{email}</strong>, a reset link is on its way.
            </span>
          </FormAlert>
          {sent.token ? (
            <DemoNote>
              Emails aren’t sent in this demo.{" "}
              <Link href={`/reset-password?token=${encodeURIComponent(sent.token)}`} className="font-medium text-foreground underline underline-offset-2">
                Open the reset link
              </Link>
              .
            </DemoNote>
          ) : null}
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field id="email" label="Email" error={error}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? "email-error" : undefined}
              disabled={pending}
            />
          </Field>
          <SubmitButton pending={pending}>{pending ? "Sending…" : "Send reset link"}</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
