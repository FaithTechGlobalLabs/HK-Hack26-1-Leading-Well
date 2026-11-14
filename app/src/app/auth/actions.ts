"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, resetDemoDb } from "@/lib/data/demo";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";

export interface FormState {
  ok?: boolean;
  error?: string;
  message?: string;
}

async function origin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signInWithEmail(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "invalid_email" };
  if (!supabaseConfigured()) return { error: "not_configured" };
  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${await origin()}/auth/callback` } });
  if (error) return { error: error.message };
  return { ok: true, message: "check_email" };
}

export async function demoSignIn(role: "pastor" | "leader") {
  if (supabaseConfigured()) throw new Error("Demo sign-in is disabled when Supabase is configured");
  (await cookies()).set(DEMO_COOKIE, role === "pastor" ? "user-pastor" : "user-leader", { path: "/", sameSite: "lax", httpOnly: true });
  redirect(role === "pastor" ? "/pastor" : "/leader");
}

export async function resetDemo() {
  if (supabaseConfigured()) throw new Error("Not available");
  resetDemoDb();
  redirect("/");
}

export async function signOut() {
  if (supabaseConfigured()) {
    const sb = await createSupabaseServerClient();
    await sb.auth.signOut();
  } else {
    (await cookies()).delete(DEMO_COOKIE);
  }
  redirect("/");
}

export async function createChurch(_prev: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get("name") ?? "").trim();
  const locale = String(form.get("locale") ?? "en");
  if (!name) return { error: "required" };
  const sb = await createSupabaseServerClient();
  const { error } = await sb.rpc("create_church", { church_name: name, church_locale: locale });
  if (error) return { error: error.message };
  redirect("/pastor");
}

export async function joinChurch(_prev: FormState, form: FormData): Promise<FormState> {
  const code = String(form.get("code") ?? "").trim();
  const locale = String(form.get("locale") ?? "en");
  if (!code) return { error: "required" };
  const sb = await createSupabaseServerClient();
  const { error } = await sb.rpc("join_church", { code, user_locale: locale });
  if (error) return { error: error.message };
  redirect("/leader");
}
