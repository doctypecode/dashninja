"use client";

import * as React from "react";
import { demoAuthAdapter } from "./demo-adapter";
import type { AuthAdapter, Session } from "./types";

export * from "./types";
export { DEMO_CREDENTIALS } from "./demo-adapter";

/** Single place to swap the auth provider. */
export function getAuthAdapter(): AuthAdapter {
  return demoAuthAdapter;
}

const subscribe = (cb: () => void) => getAuthAdapter().subscribe(cb);
const getSnapshot = () => getAuthAdapter().getSession();
const getServerSnapshot = () => undefined;

/**
 * Current session. `undefined` while hydrating (server render), `null` when signed out.
 */
export function useSession(): Session | null | undefined {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Only allow same-origin relative redirects. */
export function safeNext(next: string | null | undefined, fallback = "/workspace"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export function useAuthAdapter() {
  return React.useMemo(() => getAuthAdapter(), []);
}
