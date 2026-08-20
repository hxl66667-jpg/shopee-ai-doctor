import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const browserKeyConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return NextResponse.json({
    ok: true,
    service: "shopee-ai-doctor",
    version: "2.1.0",
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && browserKeyConfigured),
    authPersistence: true,
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
