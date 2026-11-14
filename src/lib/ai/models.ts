/** Model choices for the AI data assistant. All go through OpenRouter. */

export type AiProvider = "auto" | "openai" | "deepseek" | "anthropic" | "nvidia";

export interface AiModel {
  id: string;
  name: string;
  provider: AiProvider;
}

export const AUTO_MODEL: AiModel = { id: "openrouter/auto", name: "Auto (OpenAI, Anthropic or DeepSeek)", provider: "auto" };

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  auto: "Auto",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  anthropic: "Anthropic",
  nvidia: "NVIDIA",
};

/** Paid models, no longer offered in the picker. Kept for reference if they come back. */
export const PAID_MODELS: AiModel[] = [
  AUTO_MODEL,
  { id: "openai/gpt-4.1", name: "GPT-4.1", provider: "openai" },
  { id: "openai/gpt-4.1-mini", name: "GPT-4.1 mini", provider: "openai" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini", provider: "openai" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3", provider: "deepseek" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "deepseek" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "anthropic" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", provider: "anthropic" },
];


export function providerOf(id: string): AiProvider {
  if (id.startsWith("openai/")) return "openai";
  if (id.startsWith("deepseek/")) return "deepseek";
  if (id.startsWith("anthropic/")) return "anthropic";
  if (id.startsWith("nvidia/")) return "nvidia";
  return "auto";
}

/** The models the assistant offers. Only free models for now. */
export const FALLBACK_MODELS: AiModel[] = [{ id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra", provider: "nvidia" }];

export const DEFAULT_MODEL_ID = FALLBACK_MODELS[0].id;

/** The server only calls models from the list above. */
export function isAllowedModel(id: string) {
  return FALLBACK_MODELS.some((m) => m.id === id);
}
