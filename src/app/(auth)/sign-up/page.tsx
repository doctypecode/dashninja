import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-96 w-full max-w-[380px] animate-pulse rounded-xl border border-border bg-surface" />}>
      <SignUpForm />
    </Suspense>
  );
}
