import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { BuilderPage, BuilderSkeleton } from "@/components/builder/builder-page";

export const metadata: Metadata = { title: "Dashboard builder" };

export default function DashboardBuilderRoute() {
  return (
    <Suspense fallback={<BuilderSkeleton />}>
      <RequireAuth>
        <BuilderPage />
      </RequireAuth>
    </Suspense>
  );
}
