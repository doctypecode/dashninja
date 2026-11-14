import { NextResponse } from "next/server";
import { listModels } from "@/lib/ai/catalog";

/** Newest text models per provider from OpenRouter's public catalog, with a static fallback. */
export async function GET() {
  return NextResponse.json(await listModels());
}
