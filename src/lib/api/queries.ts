"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Dashboard, DashboardSummary } from "@/lib/model/types";
import { getRepository, summarize } from "./repository";

export const queryKeys = {
  workspaces: ["workspaces"] as const,
  dashboards: (workspaceId: string) => ["dashboards", workspaceId] as const,
  dashboard: (id: string) => ["dashboard", id] as const,
};

const repo = () => getRepository();

export function useWorkspaces() {
  return useQuery({ queryKey: queryKeys.workspaces, queryFn: () => repo().listWorkspaces(), staleTime: Infinity });
}

export function useDashboards(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.dashboards(workspaceId ?? "none"),
    queryFn: () => repo().listDashboards(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useDashboard(id: string) {
  return useQuery({
    queryKey: queryKeys.dashboard(id),
    queryFn: () => repo().getDashboard(id),
    // The builder owns the draft; don't refetch underneath it.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: (count, err) => !(err instanceof Error && err.message.includes("not found")) && count < 2,
  });
}

export function useCreateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { workspaceId: string; template: "blank" | "sample-data" }) => repo().createDashboard(v.workspaceId, v.template),
    onSuccess: (d) => {
      qc.setQueryData(queryKeys.dashboard(d.id), d);
      qc.invalidateQueries({ queryKey: queryKeys.dashboards(d.workspaceId) });
    },
  });
}

export function useSaveDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: Dashboard) => repo().saveDashboard(d),
    onSuccess: (d) => {
      qc.setQueryData(queryKeys.dashboard(d.id), d);
      qc.invalidateQueries({ queryKey: queryKeys.dashboards(d.workspaceId) });
    },
  });
}

/** Optimistically patch a summary in the workspace list. */
function patchList(qc: ReturnType<typeof useQueryClient>, workspaceId: string, fn: (list: DashboardSummary[]) => DashboardSummary[]) {
  const key = queryKeys.dashboards(workspaceId);
  const prev = qc.getQueryData<DashboardSummary[]>(key);
  if (prev) qc.setQueryData(key, fn(prev));
  return () => qc.setQueryData(key, prev);
}

export function useRenameDashboard(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; name: string }) => repo().renameDashboard(v.id, v.name),
    onMutate: (v) => ({ rollback: patchList(qc, workspaceId, (l) => l.map((d) => (d.id === v.id ? { ...d, name: v.name } : d))) }),
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (d) => qc.setQueryData(queryKeys.dashboard(d.id), d),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.dashboards(workspaceId) }),
  });
}

export function useDuplicateDashboard(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo().duplicateDashboard(id),
    onSuccess: (d) => {
      patchList(qc, workspaceId, (l) => [summarize(d), ...l]);
      qc.invalidateQueries({ queryKey: queryKeys.dashboards(workspaceId) });
    },
  });
}

export function useDeleteDashboard(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo().deleteDashboard(id),
    onMutate: (id) => ({ rollback: patchList(qc, workspaceId, (l) => l.filter((d) => d.id !== id)) }),
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (_d, id) => qc.removeQueries({ queryKey: queryKeys.dashboard(id) }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.dashboards(workspaceId) }),
  });
}
