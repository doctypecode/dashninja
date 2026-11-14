/** Model choices for the AI data assistant. All go through OpenRouter. */

export type AiProvider = "auto" | "openai" | "deepseek" | "anthropic";

export interface AiModel {
  id: string;
  name: string;
  provider: AiProvider;
}

export const AUTO_MODEL: AiModel = { id: "openrouter/auto", name: "Auto (OpenRouter picks)", provider: "auto" };

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  auto: "Auto",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  anthropic: "Anthropic",
};

/**
 * Used when the live OpenRouter model list can't be fetched. The server
 * replaces this with the newest models per provider when it can reach
 * openrouter.ai/api/v1/models.
 */
export const FALLBACK_MODELS: AiModel[] = [
  AUTO_MODEL,
  { id: "openai/gpt-4.1", name: "GPT-4.1", provider: "openai" },
  { id: "openai/gpt-4.1-mini", name: "GPT-4.1 mini", provider: "openai" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini", provider: "openai" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3", provider: "deepseek" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "deepseek" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "anthropic" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", provider: "anthropic" },
];

export const DEFAULT_MODEL_ID = AUTO_MODEL.id;

export function providerOf(id: string): AiProvider {
  if (id.startsWith("openai/")) return "openai";
  if (id.startsWith("deepseek/")) return "deepseek";
  if (id.startsWith("anthropic/")) return "anthropic";
  return "auto";
}

export function isAllowedModel(id: string) {
  return id === AUTO_MODEL.id || /^(openai|deepseek|anthropic)\/[\w.:-]+$/.test(id);
}
