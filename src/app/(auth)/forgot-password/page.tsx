import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-96 w-full max-w-[380px] animate-pulse rounded-xl border border-border bg-surface" />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
