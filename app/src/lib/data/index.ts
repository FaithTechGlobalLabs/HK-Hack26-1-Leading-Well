import { supabaseConfigured } from "../supabase/server";
import { DemoRepo } from "./demo";
import { SupabaseRepo } from "./supabase";
import type { AppUser, Group, Repo } from "./types";

export * from "./types";

/** Supabase when configured, otherwise the local demo store (offline mode). */
export function getRepo(): Repo {
  return supabaseConfigured() ? new SupabaseRepo() : new DemoRepo();
}

export function canAccessGroup(user: AppUser, group: Group | null): group is Group {
  if (!group) return false;
  return group.leader_id === user.id || (user.role === "pastor" && group.church_id === user.church_id);
}
