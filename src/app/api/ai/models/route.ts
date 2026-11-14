import { NextResponse } from "next/server";
import { AUTO_MODEL, FALLBACK_MODELS, providerOf, type AiModel } from "@/lib/ai/models";

const PER_PROVIDER = 6;

/** Newest text models per provider from OpenRouter's public catalog, with a static fallback. */
export async function GET() {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`OpenRouter responded ${res.status}`);
    const json = (await res.json()) as {
      data: { id: string; name: string; created?: number; architecture?: { output_modalities?: string[] } }[];
    };
    const models: AiModel[] = [AUTO_MODEL];
    for (const provider of ["openai", "deepseek", "anthropic"] as const) {
      const list = json.data
        .filter((m) => m.id.startsWith(`${provider}/`) && !m.id.endsWith(":free"))
        .filter((m) => !m.architecture?.output_modalities || m.architecture.output_modalities.includes("text"))
        .filter((m) => !/image|audio|embed|search|realtime|tts|transcribe/i.test(m.id))
        .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
        .slice(0, PER_PROVIDER)
        .map((m) => ({ id: m.id, name: m.name.replace(/^[^:]+:\s*/, ""), provider: providerOf(m.id) }));
      models.push(...list);
    }
    return NextResponse.json({ models, live: true });
  } catch {
    return NextResponse.json({ models: FALLBACK_MODELS, live: false });
  }
}
