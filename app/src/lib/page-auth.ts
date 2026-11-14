import { redirect } from "next/navigation";
import { getRepo, type AppUser, type Repo } from "@/lib/data";

/** For pages: returns the signed-in user or redirects to the landing page / onboarding. */
export async function pageUser(repo: Repo = getRepo(), role?: "pastor"): Promise<AppUser> {
  const user = await repo.getCurrentUser();
  if (!user) {
    if (repo.kind === "supabase") {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const { data } = await (await createSupabaseServerClient()).auth.getUser();
      if (data.user) redirect("/onboarding");
    }
    redirect("/");
  }
  if (role && user.role !== role) redirect("/leader");
  return user;
}

export async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
