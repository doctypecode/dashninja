import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmail } from "@/components/auth/verify-email";

export const metadata: Metadata = { title: "Verify email" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-96 w-full max-w-[380px] animate-pulse rounded-xl border border-border bg-surface" />}>
      <VerifyEmail />
    </Suspense>
  );
}
