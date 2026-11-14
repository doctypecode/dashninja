import type { Dashboard, DashboardSummary, Workspace } from "@/lib/model/types";
import { createBlankDashboard, createSampleDashboard, createStarterDashboard } from "@/lib/model/sample-dashboard";
import { SOURCE_KIND_LABELS } from "@/lib/connectors";
import { sleep, uid } from "@/lib/utils";

/**
 * Persistence contract for workspaces and dashboards. The demo implementation
 * stores JSON in localStorage per signed-in user with simulated latency; a real
 * implementation would call an API. Components only use the TanStack Query
 * hooks in ./queries, which call this interface.
 */
export interface DashboardRepository {
  listWorkspaces(): Promise<Workspace[]>;
  listDashboards(workspaceId: string): Promise<DashboardSummary[]>;
  getDashboard(id: string): Promise<Dashboard>;
  createDashboard(workspaceId: string, template: "blank" | "sample-data"): Promise<Dashboard>;
  saveDashboard(dashboard: Dashboard): Promise<Dashboard>;
  renameDashboard(id: string, name: string): Promise<Dashboard>;
  duplicateDashboard(id: string): Promise<Dashboard>;
  deleteDashboard(id: string): Promise<void>;
}

export class NotFoundError extends Error {}

const WORKSPACES: Workspace[] = [
  { id: "ws_personal", name: "Personal", kind: "personal" },
  { id: "ws_team", name: "Team workspace", kind: "team", demo: true },
];

const SIMULATE_FAILURE_KEY = "dashninja:demo:fail-saves";

export function getSimulateSaveFailure(): boolean {
  try {
    return localStorage.getItem(SIMULATE_FAILURE_KEY) === "1";
  } catch {
    return false;
  }
}
export function setSimulateSaveFailure(on: boolean) {
  try {
    if (on) localStorage.setItem(SIMULATE_FAILURE_KEY, "1");
    else localStorage.removeItem(SIMULATE_FAILURE_KEY);
  } catch {
    /* ignore */
  }
}

function currentUserId(): string {
  try {
    const s = JSON.parse(localStorage.getItem("dashninja:auth:session") ?? "null");
    return s?.user?.id ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

function storeKey() {
  return `dashninja:v1:${currentUserId()}:dashboards`;
}

function readAll(): Dashboard[] {
  const key = storeKey();
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Dashboard[];
  } catch {
    /* fall through to seed */
  }
  const seeded = [createSampleDashboard("dash_sample", "ws_personal", new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString())];
  writeAll(seeded);
  return seeded;
}

function writeAll(list: Dashboard[]) {
  try {
    localStorage.setItem(storeKey(), JSON.stringify(list));
  } catch (e) {
    throw new Error(
      e instanceof DOMException && e.name === "QuotaExceededError"
        ? "Browser storage is full. Remove large imported files or dashboards and try again."
        : "Could not write to browser storage.",
    );
  }
}

export function summarize(d: Dashboard): DashboardSummary {
  const kinds = [...new Set(d.sources.map((s) => (s.kind === "sample" ? "Sample data" : SOURCE_KIND_LABELS[s.kind])))];
  return {
    id: d.id,
    workspaceId: d.workspaceId,
    name: d.name,
    status: d.status,
    isSample: d.isSample,
    updatedAt: d.updatedAt,
    sourceSummary:
      d.sources.length === 0
        ? "No data connected"
        : `${d.sources.length} source${d.sources.length > 1 ? "s" : ""} · ${kinds.join(", ")}`,
    widgetCount: d.widgets.length,
    thumbnail: d.widgets.map((w) => ({ type: w.type, layout: w.layout })),
  };
}

const latency = () => sleep(180 + Math.random() * 220);

export const localDashboardRepository: DashboardRepository = {
  async listWorkspaces() {
    await latency();
    return WORKSPACES;
  },
  async listDashboards(workspaceId) {
    await latency();
    return readAll()
      .filter((d) => d.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(summarize);
  },
  async getDashboard(id) {
    await latency();
    const d = readAll().find((x) => x.id === id);
    if (!d) throw new NotFoundError("Dashboard not found");
    return d;
  },
  async createDashboard(workspaceId, template) {
    await latency();
    const now = new Date().toISOString();
    const id = uid("dash");
    const d = template === "sample-data" ? createStarterDashboard(id, workspaceId, now) : createBlankDashboard(id, workspaceId, now);
    writeAll([...readAll(), d]);
    return d;
  },
  async saveDashboard(dashboard) {
    await sleep(500 + Math.random() * 300);
    if (getSimulateSaveFailure()) throw new Error("The server didn't respond (simulated failure). Your changes are still in this tab.");
    const list = readAll();
    const idx = list.findIndex((d) => d.id === dashboard.id);
    if (idx < 0) throw new NotFoundError("Dashboard was deleted");
    const saved = { ...dashboard, updatedAt: new Date().toISOString() };
    list[idx] = saved;
    writeAll(list);
    return saved;
  },
  async renameDashboard(id, name) {
    await latency();
    const list = readAll();
    const d = list.find((x) => x.id === id);
    if (!d) throw new NotFoundError("Dashboard not found");
    d.name = name.trim() || d.name;
    d.updatedAt = new Date().toISOString();
    writeAll(list);
    return d;
  },
  async duplicateDashboard(id) {
    await latency();
    const list = readAll();
    const d = list.find((x) => x.id === id);
    if (!d) throw new NotFoundError("Dashboard not found");
    const now = new Date().toISOString();
    const copy: Dashboard = {
      ...structuredClone(d),
      id: uid("dash"),
      name: `${d.name.replace(/ \(sample\)$/, "")} copy`,
      isSample: false,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    writeAll([...list, copy]);
    return copy;
  },
  async deleteDashboard(id) {
    await latency();
    writeAll(readAll().filter((d) => d.id !== id));
  },
};

export function getRepository(): DashboardRepository {
  return localDashboardRepository;
}
