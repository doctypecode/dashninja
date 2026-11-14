"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AuthError, DEMO_CREDENTIALS, useAuthAdapter } from "@/lib/auth";
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

export function SignInForm() {
  useRedirectIfSignedIn();
  const auth = useAuthAdapter();
  const router = useRouter();
  const next = useNextParam();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [touched, setTouched] = React.useState<{ email?: boolean; password?: boolean }>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [pending, setPending] = React.useState<"password" | "google" | null>(null);
  const [error, setError] = React.useState<AuthError | null>(null);

  const emailError = (touched.email || submitted) ? validateEmail(email) : null;
  const passwordError = (touched.password || submitted) ? validatePassword(password, "signin") : null;
  const nextQuery = next !== "/workspace" ? `?next=${encodeURIComponent(next)}` : "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (validateEmail(email) || validatePassword(password, "signin")) return;
    setPending("password");
    try {
      await auth.signIn({ email, password });
      router.replace(next);
    } catch (err) {
      setError(err instanceof AuthError ? err : new AuthError("network", "Something went wrong. Try again."));
      setPending(null);
    }
  }

  async function onGoogle() {
    setError(null);
    setPending("google");
    try {
      await auth.signInWithGoogle();
      router.replace(next);
    } catch {
      setError(new AuthError("network", "Google sign-in was cancelled or failed. Try again."));
      setPending(null);
    }
  }

  return (
    <AuthCard
      title="Sign in to DashNinja"
      description={next !== "/workspace" ? "Sign in to continue where you left off." : "Welcome back."}
      footer={
        <>
          New to DashNinja?{" "}
          <Link href={`/sign-up${nextQuery}`} className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton pending={pending === "google"} disabled={pending === "password"} onClick={onGoogle} />
      <Divider />
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {error ? (
          <FormAlert>
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {error.message}{" "}
              {error.code === "email_unverified" ? (
                <Link href={`/verify-email?email=${encodeURIComponent(email)}${nextQuery ? `&next=${encodeURIComponent(next)}` : ""}`} className="font-medium underline underline-offset-2">
                  Resend verification email
                </Link>
              ) : null}
            </span>
          </FormAlert>
        ) : null}
        <Field id="email" label="Email" error={emailError}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            aria-invalid={Boolean(emailError) || undefined}
            aria-describedby={emailError ? "email-error" : undefined}
            disabled={pending !== null}
          />
        </Field>
        <Field
          id="password"
          label="Password"
          error={passwordError}
          aside={
            <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            invalid={Boolean(passwordError)}
            disabled={pending !== null}
          />
        </Field>
        <SubmitButton pending={pending === "password"} disabled={pending === "google"}>
          {pending === "password" ? "Signing in…" : "Sign in"}
        </SubmitButton>
      </form>
      <DemoNote>
        Accounts are stored only in this browser. Try{" "}
        <button
          type="button"
          className="font-mono text-foreground underline underline-offset-2"
          onClick={() => {
            setEmail(DEMO_CREDENTIALS.email);
            setPassword(DEMO_CREDENTIALS.password);
            setError(null);
          }}
        >
          {DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}
        </button>
        . Google sign-in is simulated.
      </DemoNote>
    </AuthCard>
  );
}
