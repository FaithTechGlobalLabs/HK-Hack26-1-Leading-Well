import type { SurveyAnswers } from "../survey/questions";
import type { GroupNeedProfile } from "../engine/needs";
import type { CatalogEntry, Resource, ResourceTag, ScoreBreakdown } from "../engine/recommend";
import type { SessionPlan } from "../ai/mock";

export type Role = "pastor" | "leader";
export type Locale = "en" | "zh-Hant";

export interface AppUser {
  id: string;
  email: string | null;
  role: Role;
  church_id: string;
  display_name: string | null;
  locale: Locale;
}

export interface Church {
  id: string;
  name: string;
  locale: Locale;
  invite_code: string;
}

export interface Group {
  id: string;
  church_id: string;
  leader_id: string;
  name: string;
  locale: Locale;
  has_rightnow_access: boolean;
  created_at: string;
}

export type SeasonStatus = "draft" | "open" | "closed";

export interface Season {
  id: string;
  group_id: string;
  name: string;
  status: SeasonStatus;
  survey_token: string;
  target_weeks: number;
  opened_at: string | null;
  created_at: string;
}

export interface SurveyInfo {
  season_id: string;
  season_name: string;
  group_name: string;
  group_locale: Locale;
  status: SeasonStatus;
}

export interface NewResponse {
  locale: Locale;
  answers: SurveyAnswers;
  free_text_scrubbed: string | null;
  free_text_tags: Record<string, number>;
  share_with_leader: boolean;
  display_name: string | null;
  crisis_flag: boolean;
}

export interface SurveyResponse extends NewResponse {
  id: string;
  season_id: string;
  created_at: string;
}

export interface NeedProfileRow {
  season_id: string;
  profile: GroupNeedProfile;
  computed_at: string;
}

export interface CatalogResource extends Resource {
  external_id: string | null;
  church_id: string | null;
  tag_status: "pending" | "ai" | "reviewed";
  tag_sources?: Record<string, "ai" | "pastor">;
}

export interface RecommendationRow {
  id: string;
  season_id: string;
  resource_id: string;
  score: number;
  breakdown: ScoreBreakdown;
  rationale_en: string | null;
  rationale_zh: string | null;
  rank: number;
  created_at: string;
  feedback: { action: "picked" | "dismissed"; rating: number | null; comment: string | null } | null;
}

export interface SessionPlanRow {
  id: string;
  season_id: string;
  resource_id: string;
  content: SessionPlan;
  locale: Locale;
  created_at: string;
}

export interface NewResource extends Omit<CatalogResource, "id" | "tags" | "embedding" | "tag_status"> {
  tags: ResourceTag[];
}

/**
 * Storage abstraction. Implemented by Supabase (production) and a local JSON-file
 * store (demo / offline mode when Supabase env vars are not set).
 * Authorisation is enforced by RLS in Supabase and by explicit checks in the demo store.
 */
export interface Repo {
  readonly kind: "supabase" | "demo";

  getCurrentUser(): Promise<AppUser | null>;
  getChurch(id: string): Promise<Church | null>;

  listGroups(user: AppUser): Promise<Group[]>;
  getGroup(id: string): Promise<Group | null>;
  createGroup(user: AppUser, input: { name: string; locale: Locale; has_rightnow_access: boolean }): Promise<Group>;
  updateGroup(id: string, patch: Partial<Pick<Group, "name" | "locale" | "has_rightnow_access">>): Promise<void>;

  listSeasons(groupId: string): Promise<Season[]>;
  getSeason(id: string): Promise<Season | null>;
  createSeason(input: { group_id: string; name: string; target_weeks: number }): Promise<Season>;
  updateSeason(id: string, patch: Partial<Pick<Season, "name" | "status" | "target_weeks" | "opened_at">>): Promise<void>;

  /** Public (no auth): survey metadata for a capability token. */
  getSurveyByToken(token: string): Promise<SurveyInfo | null>;
  /** Public (no auth): insert a response if the season is open. */
  submitResponse(token: string, response: NewResponse): Promise<void>;

  listResponses(seasonId: string): Promise<SurveyResponse[]>;

  getObservations(seasonId: string): Promise<Record<string, number>>;
  setObservations(seasonId: string, values: Record<string, number | null>): Promise<void>;

  getNeedProfile(seasonId: string): Promise<NeedProfileRow | null>;
  saveNeedProfile(seasonId: string, profile: GroupNeedProfile): Promise<void>;

  /** Global + church-specific resources with tags (embeddings optional). */
  listResources(churchId: string): Promise<CatalogResource[]>;
  getResource(id: string): Promise<CatalogResource | null>;
  createResources(churchId: string, items: NewResource[]): Promise<number>;
  setResourceTags(resourceId: string, tags: ResourceTag[], source: "ai" | "pastor"): Promise<void>;
  /** Best-first resource ids by cosine similarity to `queryText` (pgvector in Supabase). */
  vectorRank(queryText: string, candidateIds: string[], n: number): Promise<string[]>;

  listCatalog(churchId: string): Promise<CatalogEntry[]>;
  upsertCatalogEntry(churchId: string, entry: CatalogEntry): Promise<void>;

  listRecommendations(seasonId: string): Promise<RecommendationRow[]>;
  replaceRecommendations(
    seasonId: string,
    rows: Omit<RecommendationRow, "id" | "season_id" | "created_at" | "feedback">[],
  ): Promise<void>;
  getRecommendation(id: string): Promise<RecommendationRow | null>;
  addFeedback(recommendationId: string, fb: { action: "picked" | "dismissed"; rating?: number | null; comment?: string | null }): Promise<void>;
  /** Resource ids picked in this group's other seasons. */
  pickedResourceIds(groupId: string, excludeSeasonId: string): Promise<string[]>;

  listSessionPlans(seasonId: string): Promise<SessionPlanRow[]>;
  saveSessionPlan(input: Omit<SessionPlanRow, "id" | "created_at">): Promise<SessionPlanRow>;
}
