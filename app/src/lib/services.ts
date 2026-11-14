import { z } from "zod";
import { analyseFreeText, explainRecommendations, generateSessionPlan } from "./ai";
import { computeGroupProfile, computeMemberProfile, type GroupNeedProfile } from "./engine/needs";
import { keywordCrisis, scrubPII } from "./engine/pii";
import { recommend, RETRIEVE_N, type Resource } from "./engine/recommend";
import { needsSummarySentence } from "./engine/text";
import { QUIZ_QUESTIONS, type SurveyAnswers } from "./survey/questions";
import { EMOTIONS, NEED_TAGS, SITUATIONS } from "./taxonomy";
import { canAccessGroup, getRepo, type AppUser, type Group, type Locale, type Repo, type Season } from "./data";

export class AccessError extends Error {
  constructor(message = "Not allowed") {
    super(message);
  }
}

export async function requireUser(repo: Repo = getRepo()): Promise<AppUser> {
  const user = await repo.getCurrentUser();
  if (!user) throw new AccessError("Not signed in");
  return user;
}

/** Loads a season and its group, throwing unless the user leads the group or is its church's pastor. */
export async function requireSeason(seasonId: string, repo: Repo = getRepo(), user?: AppUser): Promise<{ user: AppUser; season: Season; group: Group }> {
  const u = user ?? (await requireUser(repo));
  const season = await repo.getSeason(seasonId);
  const group = season ? await repo.getGroup(season.group_id) : null;
  if (!season || !canAccessGroup(u, group)) throw new AccessError("Season not found");
  return { user: u, season, group };
}

export async function requireGroup(groupId: string, repo: Repo = getRepo(), user?: AppUser) {
  const u = user ?? (await requireUser(repo));
  const group = await repo.getGroup(groupId);
  if (!canAccessGroup(u, group)) throw new AccessError("Group not found");
  return { user: u, group };
}

// ---------- survey submission ----------

const small = z.number().int().min(0).max(4);
export const surveyInputSchema = z.object({
  locale: z.enum(["en", "zh-Hant"]),
  answers: z.object({
    context: z.object({
      lifeStage: z.string().max(40).optional(),
      years: z.string().max(40).optional(),
      involvement: z.string().max(40).optional(),
      language: z.string().max(40).optional(),
    }),
    confidence: z.record(z.string().max(40), z.number().int().min(1).max(5)),
    quiz: z.record(z.string().max(40), z.string().max(40)),
    practice: z.record(z.string().max(40), small),
    events: z.array(z.string()).max(SITUATIONS.length).transform((xs) => xs.filter((x) => SITUATIONS.includes(x))),
    emotions: z.record(z.string(), small).transform((o) => Object.fromEntries(Object.entries(o).filter(([k]) => (EMOTIONS as string[]).includes(k)))),
    interests: z.array(z.string()).max(3).transform((xs) => xs.filter((x) => NEED_TAGS.includes(x))),
    format: z.enum(["video", "discussion", "reading", "mixed"]).optional().transform((f) => (f === "mixed" ? undefined : f)),
    depth: z.number().int().min(1).max(3).optional(),
    prepMinutes: z.number().int().min(0).max(240).optional(),
  }),
  freeText: z.string().max(2000).optional().default(""),
  shareWithLeader: z.boolean().default(false),
  displayName: z.string().trim().max(60).optional().default(""),
});
export type SurveyInput = z.input<typeof surveyInputSchema>;

export interface SubmitResult {
  ok: boolean;
  crisis: boolean;
  error?: "closed" | "invalid";
}

export async function submitSurvey(token: string, raw: unknown, repo: Repo = getRepo()): Promise<SubmitResult> {
  const parsed = surveyInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, crisis: false, error: "invalid" };
  const input = parsed.data;
  const info = await repo.getSurveyByToken(token);
  if (!info || info.status !== "open") return { ok: false, crisis: false, error: "closed" };

  const text = input.freeText.trim();
  const scrubbed = text ? scrubPII(text).text : "";
  // Only scrubbed text leaves the server or is stored; the keyword check also runs on the original as a safety net.
  const analysis = text ? await analyseFreeText(scrubbed) : { needs: {}, crisis: false };
  const crisis = analysis.crisis || (text ? keywordCrisis(text) : false);
  const share = input.shareWithLeader && !!input.displayName;

  await repo.submitResponse(token, {
    locale: input.locale,
    answers: input.answers as SurveyAnswers,
    free_text_scrubbed: scrubbed || null,
    free_text_tags: analysis.needs,
    share_with_leader: share,
    display_name: share ? input.displayName : null,
    crisis_flag: crisis,
  });
  return { ok: true, crisis };
}

// ---------- needs ----------

export async function recomputeNeeds(seasonId: string, repo: Repo = getRepo()): Promise<GroupNeedProfile> {
  const responses = await repo.listResponses(seasonId);
  const observations = await repo.getObservations(seasonId);
  const members = responses.map((r) => computeMemberProfile(r.answers, QUIZ_QUESTIONS, r.free_text_tags ?? {}));
  const profile = computeGroupProfile(members, observations);
  await repo.saveNeedProfile(seasonId, profile);
  return profile;
}

// ---------- recommendations ----------

export async function generateRecommendations(seasonId: string, repo: Repo = getRepo()) {
  const { season, group } = await requireSeason(seasonId, repo);
  const profile = (await repo.getNeedProfile(seasonId))?.profile ?? (await recomputeNeeds(seasonId, repo));
  if (profile.n === 0) return [];

  const [resources, catalog, picked] = await Promise.all([
    repo.listResources(group.church_id),
    repo.listCatalog(group.church_id),
    repo.pickedResourceIds(group.id, seasonId),
  ]);
  const byId = new Map(resources.map((r) => [r.id, r]));
  const previouslyCoveredTags = [...new Set(picked.flatMap((id) => byId.get(id)?.tags.filter((t) => t.relevance >= 0.5).map((t) => t.tag) ?? []))];

  const vectorRanking = await repo
    .vectorRank(needsSummarySentence(profile), resources.map((r) => r.id), RETRIEVE_N)
    .catch(() => undefined);

  const recs = recommend(resources, catalog, {
    profile,
    locale: group.locale,
    hasRightNowAccess: group.has_rightnow_access,
    targetWeeks: season.target_weeks,
    recentlyUsed: picked,
    previouslyCoveredTags,
    vectorRanking,
    k: 4,
  });
  const rationales = await explainRecommendations(recs, profile);
  const rmap = new Map(rationales.map((r) => [r.resource_id, r]));
  await repo.replaceRecommendations(
    seasonId,
    recs.map((r) => ({
      resource_id: r.resource.id,
      score: r.score,
      breakdown: r.breakdown,
      rationale_en: rmap.get(r.resource.id)?.rationale_en ?? null,
      rationale_zh: rmap.get(r.resource.id)?.rationale_zh ?? null,
      rank: r.rank,
    })),
  );
  return recs;
}

export async function pickRecommendation(recommendationId: string, locale?: Locale, repo: Repo = getRepo()) {
  const rec = await repo.getRecommendation(recommendationId);
  if (!rec) throw new AccessError("Recommendation not found");
  const { group } = await requireSeason(rec.season_id, repo);
  const resource = await repo.getResource(rec.resource_id);
  if (!resource) throw new AccessError("Resource not found");
  const profile = (await repo.getNeedProfile(rec.season_id))?.profile ?? (await recomputeNeeds(rec.season_id, repo));
  await repo.addFeedback(recommendationId, { action: "picked" });
  const planLocale = locale ?? group.locale;
  const content = await generateSessionPlan(resource as Resource, profile, planLocale);
  return repo.saveSessionPlan({ season_id: rec.season_id, resource_id: resource.id, content, locale: planLocale });
}

export async function recordFeedback(
  recommendationId: string,
  fb: { action: "picked" | "dismissed"; rating?: number | null; comment?: string | null },
  repo: Repo = getRepo(),
) {
  const rec = await repo.getRecommendation(recommendationId);
  if (!rec) throw new AccessError("Recommendation not found");
  await requireSeason(rec.season_id, repo);
  await repo.addFeedback(recommendationId, {
    action: fb.action,
    rating: fb.rating == null ? null : Math.min(5, Math.max(1, Math.round(fb.rating))),
    comment: fb.comment?.slice(0, 1000) ?? null,
  });
}
