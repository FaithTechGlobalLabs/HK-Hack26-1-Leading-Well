"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRepo, type Locale, type SeasonStatus } from "@/lib/data";
import { NEED_TAGS } from "@/lib/taxonomy";
import {
  generateRecommendations,
  pickRecommendation,
  recomputeNeeds,
  recordFeedback,
  requireGroup,
  requireSeason,
  requireUser,
} from "@/lib/services";

const locale = (v: FormDataEntryValue | null): Locale => (v === "en" ? "en" : "zh-Hant");

export async function createGroupAction(form: FormData) {
  const repo = getRepo();
  const user = await requireUser(repo);
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!name) return;
  await repo.createGroup(user, { name, locale: locale(form.get("locale")), has_rightnow_access: form.get("rightnow") === "on" });
  revalidatePath("/leader");
}

export async function updateGroupAction(groupId: string, form: FormData) {
  const repo = getRepo();
  await requireGroup(groupId, repo);
  await repo.updateGroup(groupId, { locale: locale(form.get("locale")), has_rightnow_access: form.get("rightnow") === "on" });
  revalidatePath("/leader");
}

export async function createSeasonAction(groupId: string, form: FormData) {
  const repo = getRepo();
  await requireGroup(groupId, repo);
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const weeks = Math.min(52, Math.max(1, parseInt(String(form.get("weeks") ?? "6"), 10) || 6));
  if (!name) return;
  const season = await repo.createSeason({ group_id: groupId, name, target_weeks: weeks });
  redirect(`/leader/seasons/${season.id}`);
}

export async function setSeasonStatusAction(seasonId: string, status: SeasonStatus) {
  const repo = getRepo();
  const { season } = await requireSeason(seasonId, repo);
  await repo.updateSeason(seasonId, { status, ...(status === "open" && !season.opened_at ? { opened_at: new Date().toISOString() } : {}) });
  revalidatePath(`/leader/seasons/${seasonId}`);
  revalidatePath("/leader");
}

export async function updateSeasonWeeksAction(seasonId: string, form: FormData) {
  const repo = getRepo();
  await requireSeason(seasonId, repo);
  const weeks = Math.min(52, Math.max(1, parseInt(String(form.get("weeks") ?? "6"), 10) || 6));
  await repo.updateSeason(seasonId, { target_weeks: weeks });
  revalidatePath(`/leader/seasons/${seasonId}`);
}

/** Leader's own estimate of each need (0-4 scale → [0,1]); blank clears the estimate. */
export async function saveObservationsAction(seasonId: string, form: FormData) {
  const repo = getRepo();
  await requireSeason(seasonId, repo);
  const values: Record<string, number | null> = {};
  for (const tag of NEED_TAGS) {
    if (!form.has(`obs_${tag}`)) continue;
    const raw = String(form.get(`obs_${tag}`));
    values[tag] = raw === "" ? null : Math.min(4, Math.max(0, Number(raw))) / 4;
  }
  await repo.setObservations(seasonId, values);
  await recomputeNeeds(seasonId, repo);
  revalidatePath(`/leader/seasons/${seasonId}`);
}

export async function refreshNeedsAction(seasonId: string) {
  const repo = getRepo();
  await requireSeason(seasonId, repo);
  await recomputeNeeds(seasonId, repo);
  revalidatePath(`/leader/seasons/${seasonId}`);
}

export async function generateRecommendationsAction(seasonId: string) {
  const repo = getRepo();
  await requireSeason(seasonId, repo);
  await recomputeNeeds(seasonId, repo);
  await generateRecommendations(seasonId, repo);
  revalidatePath(`/leader/seasons/${seasonId}`);
}

export async function pickRecommendationAction(seasonId: string, recommendationId: string, form: FormData) {
  const repo = getRepo();
  await pickRecommendation(recommendationId, form.get("locale") === "en" ? "en" : form.get("locale") === "zh-Hant" ? "zh-Hant" : undefined, repo);
  revalidatePath(`/leader/seasons/${seasonId}`);
  redirect(`/leader/seasons/${seasonId}#plans`);
}

export async function dismissRecommendationAction(seasonId: string, recommendationId: string) {
  await recordFeedback(recommendationId, { action: "dismissed" });
  revalidatePath(`/leader/seasons/${seasonId}`);
}

export async function rateRecommendationAction(seasonId: string, recommendationId: string, form: FormData) {
  const repo = getRepo();
  const rec = await repo.getRecommendation(recommendationId);
  const rating = Number(form.get("rating"));
  await recordFeedback(
    recommendationId,
    {
      action: rec?.feedback?.action ?? "picked",
      rating: Number.isFinite(rating) && rating > 0 ? rating : null,
      comment: String(form.get("comment") ?? "").trim() || null,
    },
    repo,
  );
  revalidatePath(`/leader/seasons/${seasonId}`);
}
