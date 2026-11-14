import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogEntry, ResourceTag } from "../engine/recommend";
import type { GroupNeedProfile } from "../engine/needs";
import { embed } from "../ai";
import { resourceEmbeddingText } from "../catalog/parse";
import { createSupabaseServerClient } from "../supabase/server";
import type {
  AppUser,
  CatalogResource,
  Group,
  Locale,
  NewResource,
  NewResponse,
  RecommendationRow,
  Repo,
  Season,
  SessionPlanRow,
  SurveyInfo,
  SurveyResponse,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const RESOURCE_COLUMNS =
  "id, external_id, church_id, source, title, title_zh, description, description_zh, url, attribution, language, units, minutes_per_unit, depth, format, has_guide, access, tag_status, resource_tags(tag_key, relevance, source)";

function check<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(res.error.message ?? String(res.error));
  return res.data;
}

function toResource(row: any): CatalogResource {
  const tags: ResourceTag[] = (row.resource_tags ?? [])
    .map((t: any) => ({ tag: t.tag_key, relevance: Number(t.relevance) }))
    .sort((a: ResourceTag, b: ResourceTag) => b.relevance - a.relevance);
  const { resource_tags, ...rest } = row;
  return {
    ...rest,
    tags,
    tag_sources: Object.fromEntries((resource_tags ?? []).map((t: any) => [t.tag_key, t.source])),
    embedding: null,
  };
}

function toRecommendation(row: any): RecommendationRow {
  const fb = [...(row.feedback ?? [])].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  const { feedback: _f, ...rest } = row;
  return { ...rest, feedback: fb ? { action: fb.action, rating: fb.rating, comment: fb.comment } : null };
}

export class SupabaseRepo implements Repo {
  readonly kind = "supabase" as const;
  private clientPromise: Promise<SupabaseClient> | null = null;

  private db(): Promise<SupabaseClient> {
    this.clientPromise ??= createSupabaseServerClient();
    return this.clientPromise;
  }

  async getCurrentUser(): Promise<AppUser | null> {
    const sb = await this.db();
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    const { data: profile } = await sb.from("profiles").select("*").eq("user_id", data.user.id).maybeSingle();
    if (!profile) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? null,
      role: profile.role,
      church_id: profile.church_id,
      display_name: profile.display_name,
      locale: profile.locale,
    };
  }

  async getChurch(id: string) {
    const sb = await this.db();
    return check(await sb.from("churches").select("*").eq("id", id).maybeSingle());
  }

  async listGroups(user: AppUser): Promise<Group[]> {
    const sb = await this.db();
    let q = sb.from("groups").select("*").order("created_at");
    q = user.role === "pastor" ? q.eq("church_id", user.church_id) : q.eq("leader_id", user.id);
    return check(await q) ?? [];
  }
  async getGroup(id: string) {
    const sb = await this.db();
    return check(await sb.from("groups").select("*").eq("id", id).maybeSingle());
  }
  async createGroup(user: AppUser, input: { name: string; locale: Locale; has_rightnow_access: boolean }) {
    const sb = await this.db();
    return check(await sb.from("groups").insert({ ...input, church_id: user.church_id, leader_id: user.id }).select().single());
  }
  async updateGroup(id: string, patch: Partial<Pick<Group, "name" | "locale" | "has_rightnow_access">>) {
    const sb = await this.db();
    check(await sb.from("groups").update(patch).eq("id", id));
  }

  async listSeasons(groupId: string): Promise<Season[]> {
    const sb = await this.db();
    return check(await sb.from("seasons").select("*").eq("group_id", groupId).order("created_at", { ascending: false })) ?? [];
  }
  async getSeason(id: string) {
    const sb = await this.db();
    return check(await sb.from("seasons").select("*").eq("id", id).maybeSingle());
  }
  async createSeason(input: { group_id: string; name: string; target_weeks: number }) {
    const sb = await this.db();
    return check(await sb.from("seasons").insert(input).select().single());
  }
  async updateSeason(id: string, patch: Partial<Pick<Season, "name" | "status" | "target_weeks" | "opened_at">>) {
    const sb = await this.db();
    check(await sb.from("seasons").update(patch).eq("id", id));
  }

  async getSurveyByToken(token: string): Promise<SurveyInfo | null> {
    const sb = await this.db();
    const rows = check(await sb.rpc("get_survey", { token })) as any[];
    return rows?.[0] ?? null;
  }
  async submitResponse(token: string, r: NewResponse) {
    const sb = await this.db();
    check(
      await sb.rpc("submit_survey_response", {
        token,
        p_locale: r.locale,
        p_answers: r.answers,
        p_free_text_scrubbed: r.free_text_scrubbed,
        p_free_text_tags: r.free_text_tags,
        p_share_with_leader: r.share_with_leader,
        p_display_name: r.display_name,
        p_crisis_flag: r.crisis_flag,
      }),
    );
  }
  async listResponses(seasonId: string): Promise<SurveyResponse[]> {
    const sb = await this.db();
    return check(await sb.from("survey_responses").select("*").eq("season_id", seasonId).order("created_at")) ?? [];
  }

  async getObservations(seasonId: string) {
    const sb = await this.db();
    const rows = check(await sb.from("leader_observations").select("tag_key, value").eq("season_id", seasonId)) ?? [];
    return Object.fromEntries(rows.map((r: any) => [r.tag_key, Number(r.value)]));
  }
  async setObservations(seasonId: string, values: Record<string, number | null>) {
    const sb = await this.db();
    const upserts = Object.entries(values)
      .filter(([, v]) => v != null)
      .map(([tag_key, value]) => ({ season_id: seasonId, tag_key, value, updated_at: new Date().toISOString() }));
    const deletes = Object.entries(values)
      .filter(([, v]) => v == null)
      .map(([k]) => k);
    if (upserts.length) check(await sb.from("leader_observations").upsert(upserts));
    if (deletes.length) check(await sb.from("leader_observations").delete().eq("season_id", seasonId).in("tag_key", deletes));
  }

  async getNeedProfile(seasonId: string) {
    const sb = await this.db();
    const row = check(await sb.from("group_need_profiles").select("*").eq("season_id", seasonId).maybeSingle()) as any;
    if (!row) return null;
    const profile: GroupNeedProfile = {
      n: row.n,
      needs: row.needs,
      hiddenNeeds: row.hidden_needs,
      depthTarget: row.depth_target,
      tieredQuestions: row.tiered_questions,
      formatShare: row.format_share,
      masterySpread: row.meta?.masterySpread ?? 0,
      medianPrepMinutes: row.meta?.medianPrepMinutes ?? null,
    };
    return { season_id: seasonId, profile, computed_at: row.computed_at };
  }
  async saveNeedProfile(seasonId: string, p: GroupNeedProfile) {
    const sb = await this.db();
    check(
      await sb.from("group_need_profiles").upsert({
        season_id: seasonId,
        needs: p.needs,
        depth_target: p.depthTarget,
        hidden_needs: p.hiddenNeeds,
        tiered_questions: p.tieredQuestions,
        format_share: p.formatShare,
        meta: { masterySpread: p.masterySpread, medianPrepMinutes: p.medianPrepMinutes },
        n: p.n,
        computed_at: new Date().toISOString(),
      }),
    );
  }

  async listResources(): Promise<CatalogResource[]> {
    const sb = await this.db();
    const out: CatalogResource[] = [];
    for (let from = 0; ; from += 1000) {
      const rows = check(await sb.from("resources").select(RESOURCE_COLUMNS).order("title").range(from, from + 999)) ?? [];
      out.push(...rows.map(toResource));
      if (rows.length < 1000) break;
    }
    return out;
  }
  async getResource(id: string) {
    const sb = await this.db();
    const row = check(await sb.from("resources").select(RESOURCE_COLUMNS).eq("id", id).maybeSingle());
    return row ? toResource(row) : null;
  }
  async createResources(churchId: string, items: NewResource[]) {
    const sb = await this.db();
    const embeddings = await embed(items.map((i) => resourceEmbeddingText(i)));
    let n = 0;
    for (const [i, item] of items.entries()) {
      const { tags, tag_sources: _ts, ...fields } = item;
      const row = check(
        await sb
          .from("resources")
          .upsert(
            { ...fields, church_id: churchId, external_id: `${churchId}:${item.external_id}`, embedding: JSON.stringify(embeddings[i]), tag_status: "ai" },
            { onConflict: "external_id" },
          )
          .select("id")
          .single(),
      ) as any;
      await this.setResourceTags(row.id, tags, "ai");
      check(await sb.from("church_catalog").upsert({ church_id: churchId, resource_id: row.id }, { onConflict: "church_id,resource_id", ignoreDuplicates: true }));
      n++;
    }
    return n;
  }
  async setResourceTags(resourceId: string, tags: ResourceTag[], source: "ai" | "pastor") {
    const sb = await this.db();
    check(await sb.from("resource_tags").delete().eq("resource_id", resourceId));
    if (tags.length) {
      check(await sb.from("resource_tags").insert(tags.map((t) => ({ resource_id: resourceId, tag_key: t.tag, relevance: t.relevance, source }))));
    }
    check(await sb.from("resources").update({ tag_status: source === "pastor" ? "reviewed" : "ai" }).eq("id", resourceId));
  }
  async vectorRank(queryText: string, candidateIds: string[], n: number) {
    const sb = await this.db();
    const [q] = await embed([queryText]);
    const rows = check(
      await sb.rpc("match_resources", { query_embedding: JSON.stringify(q), match_count: n, candidate_ids: candidateIds }),
    ) as any[];
    return (rows ?? []).map((r) => r.id);
  }

  async listCatalog(churchId: string): Promise<CatalogEntry[]> {
    const sb = await this.db();
    const rows = check(await sb.from("church_catalog").select("resource_id, status, priority, notes").eq("church_id", churchId)) ?? [];
    return rows.map((r: any) => ({ ...r, priority: Number(r.priority) }));
  }
  async upsertCatalogEntry(churchId: string, entry: CatalogEntry) {
    const sb = await this.db();
    check(await sb.from("church_catalog").upsert({ church_id: churchId, ...entry, updated_at: new Date().toISOString() }));
  }

  async listRecommendations(seasonId: string) {
    const sb = await this.db();
    const rows = check(await sb.from("recommendations").select("*, feedback(action, rating, comment, created_at)").eq("season_id", seasonId).order("rank")) ?? [];
    return rows.map(toRecommendation);
  }
  async replaceRecommendations(seasonId: string, rows: Omit<RecommendationRow, "id" | "season_id" | "created_at" | "feedback">[]) {
    const sb = await this.db();
    check(await sb.from("recommendations").delete().eq("season_id", seasonId));
    if (rows.length) check(await sb.from("recommendations").insert(rows.map((r) => ({ ...r, season_id: seasonId }))));
  }
  async getRecommendation(id: string) {
    const sb = await this.db();
    const row = check(await sb.from("recommendations").select("*, feedback(action, rating, comment, created_at)").eq("id", id).maybeSingle());
    return row ? toRecommendation(row) : null;
  }
  async addFeedback(id: string, fb: { action: "picked" | "dismissed"; rating?: number | null; comment?: string | null }) {
    const sb = await this.db();
    check(await sb.from("feedback").insert({ recommendation_id: id, action: fb.action, rating: fb.rating ?? null, comment: fb.comment ?? null }));
  }
  async pickedResourceIds(groupId: string, excludeSeasonId: string) {
    const sb = await this.db();
    const seasons = (check(await sb.from("seasons").select("id").eq("group_id", groupId).neq("id", excludeSeasonId)) ?? []).map((s: any) => s.id);
    if (!seasons.length) return [];
    const rows = check(await sb.from("recommendations").select("resource_id, feedback!inner(action)").in("season_id", seasons).eq("feedback.action", "picked")) ?? [];
    return rows.map((r: any) => r.resource_id);
  }

  async listSessionPlans(seasonId: string): Promise<SessionPlanRow[]> {
    const sb = await this.db();
    return check(await sb.from("session_plans").select("*").eq("season_id", seasonId).order("created_at", { ascending: false })) ?? [];
  }
  async saveSessionPlan(input: Omit<SessionPlanRow, "id" | "created_at">) {
    const sb = await this.db();
    return check(await sb.from("session_plans").insert(input).select().single());
  }
}
