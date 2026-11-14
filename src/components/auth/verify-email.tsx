"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2Icon, Loader2Icon, MailIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthError, safeNext, useAuthAdapter } from "@/lib/auth";
import { AuthCard, DemoNote, FormAlert } from "./auth-ui";

type State =
  | { kind: "pending" }
  | { kind: "verifying" }
  | { kind: "verified" }
  | { kind: "invalid"; message: string };

export function VerifyEmail() {
  const params = useSearchParams();
  const auth = useAuthAdapter();
  const router = useRouter();
  const email = params.get("email") ?? "";
  const token = params.get("token");
  const next = safeNext(params.get("next"));
  const [demoToken, setDemoToken] = React.useState(params.get("demo"));
  const [state, setState] = React.useState<State>(token ? { kind: "verifying" } : { kind: "pending" });
  const [resending, setResending] = React.useState(false);
  const [resent, setResent] = React.useState(false);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    auth
      .verifyEmail(token)
      .then(() => setState({ kind: "verified" }))
      .catch((e) => setState({ kind: "invalid", message: e instanceof AuthError ? e.message : "Verification failed." }));
  }, [token, auth]);

  async function resend() {
    setResending(true);
    const res = await auth.resendVerification(email);
    if (res.verificationToken) setDemoToken(res.verificationToken);
    setResending(false);
    setResent(true);
  }

  const verifyHref = demoToken
    ? `/verify-email?token=${encodeURIComponent(demoToken)}&email=${encodeURIComponent(email)}${next !== "/workspace" ? `&next=${encodeURIComponent(next)}` : ""}`
    : null;

  if (state.kind === "verifying") {
    return (
      <AuthCard title="Verifying your email">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2Icon className="size-4 animate-spin" aria-hidden /> Checking your verification link…
        </p>
      </AuthCard>
    );
  }

  if (state.kind === "verified") {
    return (
      <AuthCard title="Email verified">
        <FormAlert tone="success">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden /> Your account is ready and you’re signed in.
        </FormAlert>
        <Button className="mt-5 w-full" onClick={() => router.replace(next)}>
          Continue to your workspace
        </Button>
      </AuthCard>
    );
  }

  if (state.kind === "invalid") {
    return (
      <AuthCard title="Link didn’t work" footer={<Link href="/sign-in" className="underline-offset-4 hover:underline">Back to sign in</Link>}>
        <FormAlert>
          <XCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.message}
        </FormAlert>
        {email ? (
          <Button variant="secondary" className="mt-4 w-full" onClick={() => router.replace(`/verify-email?email=${encodeURIComponent(email)}`)}>
            Request a new link
          </Button>
        ) : null}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Check your email"
      description={
        email ? (
          <>
            We sent a verification link to <span className="font-medium text-foreground">{email}</span>.
          </>
        ) : (
          "We sent you a verification link."
        )
      }
      footer={<Link href="/sign-in" className="underline-offset-4 hover:underline">Back to sign in</Link>}
    >
      <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 p-3 text-sm">
        <MailIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">Open the link to activate your account. It expires in 24 hours.</span>
      </div>
      {email ? (
        <Button variant="secondary" className="mt-4 w-full" onClick={resend} disabled={resending}>
          {resending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
          {resent ? "Sent again" : "Resend email"}
        </Button>
      ) : null}
      {verifyHref ? (
        <DemoNote>
          Emails aren’t sent in this demo.{" "}
          <Link href={verifyHref} className="font-medium text-foreground underline underline-offset-2">
            Open the verification link
          </Link>
          .
        </DemoNote>
      ) : null}
    </AuthCard>
  );
}
