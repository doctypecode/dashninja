"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth";
import { LogoMark } from "@/components/brand/logo";

/**
 * Client-side gate for protected routes. The proxy already redirects requests
 * without a session cookie; this also covers expired or cleared sessions and
 * preserves the intended destination in ?next=.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  React.useEffect(() => {
    if (session === null) {
      const next = `${pathname}${search.size ? `?${search.toString()}` : ""}`;
      router.replace(`/sign-in?next=${encodeURIComponent(next)}`);
    }
  }, [session, pathname, search, router]);
  if (!session) return <FullPageLoader label={session === null ? "Redirecting to sign in…" : "Loading…"} />;
  return <>{children}</>;
}

export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <LogoMark className="size-6 animate-pulse text-foreground" />
        {label}
      </div>
    </div>
  );
}
