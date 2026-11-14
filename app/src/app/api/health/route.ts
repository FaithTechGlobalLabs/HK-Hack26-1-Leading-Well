import { aiEnabled } from "@/lib/ai";
import { supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, storage: supabaseConfigured() ? "supabase" : "demo", ai: aiEnabled() ? "openai" : "mock" });
}
