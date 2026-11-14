import { Suspense } from "react";
import { RequireAuth, FullPageLoader } from "@/components/auth/require-auth";
import { WorkspaceNavbar } from "@/components/workspace/workspace-navbar";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <RequireAuth>
        <div className="flex min-h-dvh flex-col">
          <WorkspaceNavbar />
          <main className="flex-1">{children}</main>
        </div>
      </RequireAuth>
    </Suspense>
  );
}
