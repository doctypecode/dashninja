import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-96 w-full max-w-[380px] animate-pulse rounded-xl border border-border bg-surface" />}>
      <SignInForm />
    </Suspense>
  );
}
