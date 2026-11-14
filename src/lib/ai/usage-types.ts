/** Daily AI spend summary shared by the server routes and the chat UI. */
export interface UsageSummary {
  /** Local calendar day on the server, YYYY-MM-DD. */
  day: string;
  limitUsd: number;
  spentUsd: number;
  remainingUsd: number;
  /** ISO time of the next local midnight, when the limit resets. */
  resetsAt: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  byModel: { model: string; costUsd: number; requests: number; promptTokens: number; completionTokens: number }[];
  /** Some costs were estimated from list prices because OpenRouter didn't report them. */
  estimated: boolean;
}
