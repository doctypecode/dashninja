"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWorkspaces } from "@/lib/api/queries";

export function useCurrentWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const workspaces = useWorkspaces();
  const id = params.get("ws") ?? "ws_personal";
  const current = workspaces.data?.find((w) => w.id === id) ?? workspaces.data?.[0] ?? null;
  const select = (wsId: string) => {
    const q = new URLSearchParams(params);
    if (wsId === "ws_personal") q.delete("ws");
    else q.set("ws", wsId);
    router.push(`${pathname}${q.size ? `?${q}` : ""}`);
  };
  return { workspaceId: current?.id ?? id, workspace: current, workspaces, select };
}
