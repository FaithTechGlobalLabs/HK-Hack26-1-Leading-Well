import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!supabaseConfigured() || !code) return NextResponse.redirect(new URL("/", url.origin));
  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/?error=auth", url.origin));
  const { data } = await sb.auth.getUser();
  const { data: profile } = await sb.from("profiles").select("role").eq("user_id", data.user!.id).maybeSingle();
  const next = !profile ? "/onboarding" : profile.role === "pastor" ? "/pastor" : "/leader";
  return NextResponse.redirect(new URL(next, url.origin));
}
