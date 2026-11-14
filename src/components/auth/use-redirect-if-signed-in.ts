"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext, useSession } from "@/lib/auth";

export function useNextParam() {
  const params = useSearchParams();
  return safeNext(params.get("next"));
}

/** Auth screens bounce signed-in users to their intended destination. */
export function useRedirectIfSignedIn() {
  const session = useSession();
  const router = useRouter();
  const next = useNextParam();
  React.useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);
  return session;
}
