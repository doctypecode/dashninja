import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-96 w-full max-w-[380px] animate-pulse rounded-xl border border-border bg-surface" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
