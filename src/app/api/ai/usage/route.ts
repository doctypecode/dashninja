import { NextResponse } from "next/server";
import { usageSummary } from "@/lib/ai/usage";

/** Today's AI spend against the daily limit. */
export async function GET(req: Request) {
  if (!/(?:^|;\s*)dn_session=[^;]+/.test(req.headers.get("cookie") ?? "")) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json(await usageSummary());
}
