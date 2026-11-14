import { AUTO_MODEL, FALLBACK_MODELS, providerOf, type AiModel } from "./models";

/** OpenRouter's public model catalog, cached in memory for an hour. Server only. */

interface CatalogEntry {
  id: string;
  name: string;
  created?: number;
  architecture?: { output_modalities?: string[] };
}

const PROVIDERS = ["openai", "deepseek", "anthropic"] as const;
const PER_PROVIDER = 6;
const TTL = 60 * 60 * 1000;

let cache: { at: number; models: AiModel[] } | null = null;

export async function listModels(): Promise<{ models: AiModel[]; live: boolean }> {
  if (cache && Date.now() - cache.at < TTL) return { models: cache.models, live: true };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`OpenRouter responded ${res.status}`);
    const json = (await res.json()) as { data: CatalogEntry[] };
    const models: AiModel[] = [AUTO_MODEL];
    for (const provider of PROVIDERS) {
      models.push(
        ...json.data
          .filter((m) => m.id.startsWith(`${provider}/`) && !m.id.endsWith(":free"))
          .filter((m) => !m.architecture?.output_modalities || m.architecture.output_modalities.includes("text"))
          .filter((m) => !/image|audio|embed|search|realtime|tts|transcribe|batch/i.test(m.id))
          .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
          .slice(0, PER_PROVIDER)
          .map((m) => ({ id: m.id, name: m.name.replace(/^[^:]+:\s*/, ""), provider: providerOf(m.id) })),
      );
    }
    cache = { at: Date.now(), models };
    return { models, live: true };
  } catch {
    return { models: FALLBACK_MODELS, live: false };
  }
}

/**
 * Candidates for "Auto": the newest model from each allowed provider, so
 * OpenRouter falls back between OpenAI, Anthropic and DeepSeek only.
 */
export async function autoCandidates(): Promise<string[]> {
  const { models } = await listModels();
  const pick = (p: (typeof PROVIDERS)[number]) => models.find((m) => m.provider === p)?.id;
  return [pick("anthropic"), pick("openai"), pick("deepseek")].filter((x): x is string => Boolean(x));
}
