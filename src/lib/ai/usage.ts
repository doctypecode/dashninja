import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UsageSummary } from "./usage-types";

/**
 * Daily AI spend ledger, kept in a JSON file next to the app
 * (.data/ai-usage.json, gitignored). Days follow the server's local time zone.
 * A real deployment would keep this per user in a database.
 */

interface ModelUsage {
  costUsd: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
}
interface DayUsage {
  models: Record<string, ModelUsage>;
  estimated?: boolean;
}
type Ledger = Record<string, DayUsage>;

// Vercel's project folder is read-only, so the ledger goes to /tmp there (per instance,
// cleared on cold starts). Set AI_USAGE_FILE to choose another path.
const FILE =
  process.env.AI_USAGE_FILE || (process.env.VERCEL ? path.join("/tmp", "dashninja-ai-usage.json") : path.join(process.cwd(), ".data", "ai-usage.json"));
const KEEP_DAYS = 31;

export function dailyLimitUsd() {
  const v = Number(process.env.AI_DAILY_LIMIT_USD);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nextMidnight(date = new Date()) {
  const n = new Date(date);
  n.setHours(24, 0, 0, 0);
  return n;
}

async function readLedger(): Promise<Ledger> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Ledger;
  } catch {
    return {};
  }
}

// Serialize writes so concurrent requests don't lose updates.
let queue: Promise<unknown> = Promise.resolve();

export async function recordUsage(entry: { model: string; costUsd: number; promptTokens: number; completionTokens: number; estimated?: boolean }) {
  const run = async () => {
    const ledger = await readLedger();
    const key = dayKey();
    const day = (ledger[key] ??= { models: {} });
    const m = (day.models[entry.model] ??= { costUsd: 0, requests: 0, promptTokens: 0, completionTokens: 0 });
    m.costUsd += entry.costUsd;
    m.requests += 1;
    m.promptTokens += entry.promptTokens;
    m.completionTokens += entry.completionTokens;
    if (entry.estimated) day.estimated = true;
    for (const k of Object.keys(ledger).sort().slice(0, -KEEP_DAYS)) delete ledger[k];
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(ledger, null, 2));
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  try {
    await p;
  } catch (e) {
    // Never fail a reply the user already paid for because the ledger couldn't be written.
    console.error("Couldn't record AI usage:", e);
  }
}

export async function usageSummary(): Promise<UsageSummary> {
  await queue.catch(() => undefined);
  const ledger = await readLedger();
  const key = dayKey();
  const day = ledger[key] ?? { models: {} };
  const byModel = Object.entries(day.models)
    .map(([model, u]) => ({ model, ...u }))
    .sort((a, b) => b.costUsd - a.costUsd);
  const spentUsd = byModel.reduce((s, m) => s + m.costUsd, 0);
  const limitUsd = dailyLimitUsd();
  return {
    day: key,
    limitUsd,
    spentUsd,
    remainingUsd: Math.max(0, limitUsd - spentUsd),
    resetsAt: nextMidnight().toISOString(),
    requests: byModel.reduce((s, m) => s + m.requests, 0),
    promptTokens: byModel.reduce((s, m) => s + m.promptTokens, 0),
    completionTokens: byModel.reduce((s, m) => s + m.completionTokens, 0),
    byModel,
    estimated: Boolean(day.estimated),
  };
}

// ---- Price lookup, used only when OpenRouter doesn't report a cost ----

let priceCache: { at: number; prices: Map<string, { prompt: number; completion: number }> } | null = null;

export async function estimateCost(model: string, promptTokens: number, completionTokens: number): Promise<number> {
  try {
    if (!priceCache || Date.now() - priceCache.at > 60 * 60 * 1000) {
      const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(8000) });
      const json = (await res.json()) as { data: { id: string; pricing?: { prompt?: string; completion?: string } }[] };
      priceCache = {
        at: Date.now(),
        prices: new Map(json.data.map((m) => [m.id, { prompt: Number(m.pricing?.prompt) || 0, completion: Number(m.pricing?.completion) || 0 }])),
      };
    }
    const p = priceCache.prices.get(model);
    return p ? p.prompt * promptTokens + p.completion * completionTokens : 0;
  } catch {
    return 0;
  }
}
