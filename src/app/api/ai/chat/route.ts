import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { AUTO_MODEL, isAllowedModel } from "@/lib/ai/models";
import { autoCandidates } from "@/lib/ai/catalog";
import type { AiChatRequest, AiChatResponse } from "@/lib/ai/protocol";
import { estimateCost, recordUsage, usageSummary } from "@/lib/ai/usage";

const OPENROUTER_URL = `${process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"}/chat/completions`;
const MAX_MESSAGES = 20;
// Free models can be slow; allow up to two minutes on Vercel.
export const maxDuration = 120;
const MAX_CONTEXT_CHARS = 60_000;

let guideCache: string | null = null;
async function builderGuide() {
  if (guideCache) return guideCache;
  try {
    guideCache = await readFile(path.join(process.cwd(), "docs", "builder-guide.md"), "utf8");
  } catch {
    guideCache = "DashNinja builder guide unavailable. Propose transformation steps as a JSON block with an actions array.";
  }
  return guideCache;
}

function error(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * AI data assistant. Takes the builder's dataset context and the chat so far,
 * calls OpenRouter with the builder guide as system context, and returns the
 * model's reply. The browser parses and validates proposed steps before applying.
 */
export async function POST(req: Request) {
  // Demo auth: only signed-in builder sessions may spend the API key.
  if (!/(?:^|;\s*)dn_session=[^;]+/.test(req.headers.get("cookie") ?? "")) return error(401, "Sign in to use the AI assistant.", "unauthorized");
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return error(503, "The AI assistant isn't configured. Add OPENROUTER_API_KEY to .env.local and restart the server.", "not_configured");

  let body: AiChatRequest;
  try {
    body = (await req.json()) as AiChatRequest;
  } catch {
    return error(400, "Invalid request body.");
  }
  if (!body?.model || !isAllowedModel(body.model)) return error(400, "That model isn't available. Pick one from the list.");
  if (!Array.isArray(body.messages) || !body.messages.length) return error(400, "Send at least one message.");

  const before = await usageSummary();
  if (before.remainingUsd <= 0) {
    return NextResponse.json(
      { error: `You've used today's $${before.limitUsd.toFixed(2)} AI limit. It resets at midnight.`, code: "limit_reached", usage: before },
      { status: 429 },
    );
  }

  let context = JSON.stringify(body.context ?? {});
  if (context.length > MAX_CONTEXT_CHARS) context = context.slice(0, MAX_CONTEXT_CHARS) + "…(truncated)";

  const modeNote =
    body.mode === "auto"
      ? "Mode: AUTO. Valid proposals are applied immediately (the user can undo). Only propose changes the user clearly asked for."
      : "Mode: PLAN. The user reviews your proposal before anything changes. Explain briefly what each step does.";

  const messages = [
    { role: "system", content: await builderGuide() },
    {
      role: "system",
      content: `${modeNote}\n\nCurrent dashboard context (JSON). Dataset ids and column names here are the only valid ones:\n${context}`,
    },
    ...body.messages.slice(-MAX_MESSAGES).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 8000) })),
  ];

  // "Auto" stays within the allowed providers: OpenRouter tries these in order.
  let routing: { model: string; models?: string[] } = { model: body.model };
  if (body.model === AUTO_MODEL.id) {
    const candidates = await autoCandidates();
    routing = candidates.length ? { model: candidates[0], models: candidates } : { model: "anthropic/claude-sonnet-4" };
  }

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "DashNinja",
      },
      // usage.include asks OpenRouter to report the exact cost of this call.
      body: JSON.stringify({ ...routing, messages, temperature: 0.2, max_tokens: 6000, usage: { include: true } }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) {
    return error(502, e instanceof Error && e.name === "TimeoutError" ? "The model took too long to answer. Try again or pick a faster model." : "Couldn't reach OpenRouter.");
  }

  const json = (await res.json().catch(() => null)) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  } | null;
  if (!res.ok || !json) {
    const msg = json?.error?.message ?? `OpenRouter responded ${res.status}.`;
    return error(res.status === 401 ? 502 : res.status >= 500 ? 502 : res.status, res.status === 401 ? "OpenRouter rejected the API key. Check OPENROUTER_API_KEY." : msg);
  }
  const content = json.choices?.[0]?.message?.content ?? "";
  const servedModel = json.model ?? body.model;
  const promptTokens = json.usage?.prompt_tokens ?? 0;
  const completionTokens = json.usage?.completion_tokens ?? 0;
  const reported = typeof json.usage?.cost === "number";
  const costUsd = reported ? json.usage!.cost! : await estimateCost(servedModel, promptTokens, completionTokens);
  await recordUsage({ model: servedModel, costUsd, promptTokens, completionTokens, estimated: !reported });
  const out: AiChatResponse = {
    content,
    model: servedModel,
    cost: { usd: costUsd, promptTokens, completionTokens, estimated: !reported },
    usage: await usageSummary(),
  };
  return NextResponse.json(out);
}
