import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server-side only (server actions, route handlers, scripts) — never import
 * from client components. Bypasses RLS, so callers must validate input themselves.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for this operation");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
