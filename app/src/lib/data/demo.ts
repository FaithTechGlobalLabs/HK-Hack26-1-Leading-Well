import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { CatalogEntry, ResourceTag } from "../engine/recommend";
import { cosine } from "../engine/recommend";
import { mockEmbedding } from "../engine/text";
import { keywordCrisis, scrubPII } from "../engine/pii";
import { keywordTags } from "../engine/text";
import { syntheticAnswers } from "../engine/synthetic";
import { loadCatalogSeeds } from "../catalog/load";
import { offlineTags, resourceEmbeddingText } from "../catalog/parse";
import type { GroupNeedProfile } from "../engine/needs";
import type {
  AppUser,
  CatalogResource,
  Church,
  Group,
  Locale,
  NeedProfileRow,
  NewResource,
  NewResponse,
  RecommendationRow,
  Repo,
  Season,
  SessionPlanRow,
  SurveyResponse,
} from "./types";

export const DEMO_COOKIE = "demo_user";
export const DEMO_TOKEN = "demo";

interface DemoDb {
  version: number;
  churches: Church[];
  users: AppUser[];
  groups: Group[];
  seasons: Season[];
  responses: SurveyResponse[];
  observations: { season_id: string; tag_key: string; value: number }[];
  profiles: NeedProfileRow[];
  resources: (Omit<CatalogResource, "embedding"> & { tag_sources: Record<string, "ai" | "pastor"> })[];
  catalog: (CatalogEntry & { church_id: string })[];
  recommendations: RecommendationRow[];
  plans: SessionPlanRow[];
}

const DB_VERSION = 1;
const now = () => new Date().toISOString();

function dbFile(): string {
  if (process.env.DEMO_DATA_FILE) return process.env.DEMO_DATA_FILE;
  const base = process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), ".data");
  return path.join(base, "demo-db.json");
}

export function buildDemoDb(): DemoDb {
  const church: Church = { id: "church-demo", name: "Grace Community Church (demo)", locale: "en", invite_code: "DEMO-INVITE" };
  const users: AppUser[] = [
    { id: "user-pastor", email: "pastor@example.org", role: "pastor", church_id: church.id, display_name: "Pastor Demo", locale: "en" },
    { id: "user-leader", email: "leader@example.org", role: "leader", church_id: church.id, display_name: "Leader Demo", locale: "en" },
  ];
  const group: Group = {
    id: "group-demo",
    church_id: church.id,
    leader_id: "user-leader",
    name: "Tuesday Night Care Group",
    locale: "en",
    has_rightnow_access: true,
    created_at: now(),
  };
  const season: Season = {
    id: "season-demo",
    group_id: group.id,
    name: "Spring term",
    status: "open",
    survey_token: DEMO_TOKEN,
    target_weeks: 6,
    opened_at: now(),
    created_at: now(),
  };
  const responses: SurveyResponse[] = syntheticAnswers(8, { seed: 2027, knowledge: 0.4, themes: ["anxiety", "rest", "ot_narrative"] }).map(
    (s, i) => {
      const scrubbed = s.freeText ? scrubPII(s.freeText).text : null;
      return {
        id: `resp-${i}`,
        season_id: season.id,
        created_at: now(),
        locale: s.locale as Locale,
        answers: s.answers,
        free_text_scrubbed: scrubbed,
        free_text_tags: Object.fromEntries(keywordTags(scrubbed ?? "").map((t) => [t.tag, 0.6])),
        share_with_leader: i % 3 === 0,
        display_name: i % 3 === 0 ? ["Ka Yan", "Ben", "Grace"][i / 3] ?? null : null,
        crisis_flag: keywordCrisis(scrubbed ?? ""),
      };
    },
  );
  const resources = loadCatalogSeeds().map(({ hint_tags, ...seed }) => {
    const tags = offlineTags({ ...seed, hint_tags });
    return {
      ...seed,
      id: seed.external_id,
      church_id: null,
      tags,
      tag_status: "ai" as const,
      tag_sources: Object.fromEntries(tags.map((t) => [t.tag, "ai" as const])),
    };
  });
  return {
    version: DB_VERSION,
    churches: [church],
    users,
    groups: [group],
    seasons: [season],
    responses,
    observations: [],
    profiles: [],
    resources,
    catalog: resources.map((r) => ({ church_id: church.id, resource_id: r.id, status: "allowed", priority: 0.5, notes: null })),
    recommendations: [],
    plans: [],
  };
}

let cache: DemoDb | null = null;
const embeddingCache = new Map<string, number[]>();

function load(): DemoDb {
  if (cache) return cache;
  const file = dbFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as DemoDb;
    if (parsed.version === DB_VERSION) {
      cache = parsed;
      return parsed;
    }
  } catch {
    // fall through to seeding
  }
  cache = buildDemoDb();
  save();
  return cache;
}

function save() {
  if (!cache) return;
  const file = dbFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cache));
}

export function resetDemoDb() {
  cache = buildDemoDb();
  save();
}

function embeddingFor(r: Pick<CatalogResource, "id" | "title" | "description" | "tags">): number[] {
  const key = `${r.id}:${r.tags.map((t) => t.tag).join(",")}`;
  let e = embeddingCache.get(key);
  if (!e) {
    e = mockEmbedding(resourceEmbeddingText(r));
    embeddingCache.set(key, e);
  }
  return e;
}

export class DemoRepo implements Repo {
  readonly kind = "demo" as const;

  async getCurrentUser(): Promise<AppUser | null> {
    const id = (await cookies()).get(DEMO_COOKIE)?.value;
    if (!id) return null;
    return load().users.find((u) => u.id === id) ?? null;
  }

  async getChurch(id: string) {
    return load().churches.find((c) => c.id === id) ?? null;
  }

  async listGroups(user: AppUser) {
    return load().groups.filter((g) => (user.role === "pastor" ? g.church_id === user.church_id : g.leader_id === user.id));
  }
  async getGroup(id: string) {
    return load().groups.find((g) => g.id === id) ?? null;
  }
  async createGroup(user: AppUser, input: { name: string; locale: Locale; has_rightnow_access: boolean }) {
    const g: Group = { id: randomUUID(), church_id: user.church_id, leader_id: user.id, created_at: now(), ...input };
    load().groups.push(g);
    save();
    return g;
  }
  async updateGroup(id: string, patch: Partial<Pick<Group, "name" | "locale" | "has_rightnow_access">>) {
    const g = load().groups.find((x) => x.id === id);
    if (g) Object.assign(g, patch);
    save();
  }

  async listSeasons(groupId: string) {
    return load()
      .seasons.filter((s) => s.group_id === groupId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async getSeason(id: string) {
    return load().seasons.find((s) => s.id === id) ?? null;
  }
  async createSeason(input: { group_id: string; name: string; target_weeks: number }) {
    const s: Season = {
      id: randomUUID(),
      status: "draft",
      survey_token: randomUUID().replace(/-/g, ""),
      opened_at: null,
      created_at: now(),
      ...input,
    };
    load().seasons.push(s);
    save();
    return s;
  }
  async updateSeason(id: string, patch: Partial<Pick<Season, "name" | "status" | "target_weeks" | "opened_at">>) {
    const s = load().seasons.find((x) => x.id === id);
    if (s) Object.assign(s, patch);
    save();
  }

  async getSurveyByToken(token: string) {
    const db = load();
    const s = db.seasons.find((x) => x.survey_token === token);
    if (!s) return null;
    const g = db.groups.find((x) => x.id === s.group_id)!;
    return { season_id: s.id, season_name: s.name, group_name: g.name, group_locale: g.locale, status: s.status };
  }
  async submitResponse(token: string, r: NewResponse) {
    const db = load();
    const s = db.seasons.find((x) => x.survey_token === token && x.status === "open");
    if (!s) throw new Error("survey not open");
    db.responses.push({
      ...r,
      display_name: r.share_with_leader ? r.display_name : null,
      id: randomUUID(),
      season_id: s.id,
      created_at: now(),
    });
    save();
  }
  async listResponses(seasonId: string) {
    return load().responses.filter((r) => r.season_id === seasonId);
  }

  async getObservations(seasonId: string) {
    return Object.fromEntries(load().observations.filter((o) => o.season_id === seasonId).map((o) => [o.tag_key, o.value]));
  }
  async setObservations(seasonId: string, values: Record<string, number | null>) {
    const db = load();
    db.observations = db.observations.filter((o) => !(o.season_id === seasonId && o.tag_key in values));
    for (const [tag_key, value] of Object.entries(values)) if (value != null) db.observations.push({ season_id: seasonId, tag_key, value });
    save();
  }

  async getNeedProfile(seasonId: string) {
    return load().profiles.find((p) => p.season_id === seasonId) ?? null;
  }
  async saveNeedProfile(seasonId: string, profile: GroupNeedProfile) {
    const db = load();
    db.profiles = db.profiles.filter((p) => p.season_id !== seasonId);
    db.profiles.push({ season_id: seasonId, profile, computed_at: now() });
    save();
  }

  async listResources(churchId: string): Promise<CatalogResource[]> {
    return load().resources.filter((r) => r.church_id == null || r.church_id === churchId);
  }
  async getResource(id: string) {
    return load().resources.find((r) => r.id === id) ?? null;
  }
  async createResources(churchId: string, items: NewResource[]) {
    const db = load();
    let n = 0;
    for (const item of items) {
      const existing = db.resources.find((r) => r.external_id && r.external_id === item.external_id && r.church_id === churchId);
      const id = existing?.id ?? randomUUID();
      const row = {
        ...item,
        id,
        church_id: churchId,
        tag_status: "ai" as const,
        tag_sources: Object.fromEntries(item.tags.map((t) => [t.tag, "ai" as const])),
      };
      if (existing) Object.assign(existing, row);
      else {
        db.resources.push(row);
        db.catalog.push({ church_id: churchId, resource_id: id, status: "allowed", priority: 0.5, notes: null });
      }
      n++;
    }
    save();
    return n;
  }
  async setResourceTags(resourceId: string, tags: ResourceTag[], source: "ai" | "pastor") {
    const r = load().resources.find((x) => x.id === resourceId);
    if (!r) return;
    r.tags = tags;
    r.tag_sources = Object.fromEntries(tags.map((t) => [t.tag, source]));
    r.tag_status = source === "pastor" ? "reviewed" : "ai";
    save();
  }
  async vectorRank(queryText: string, candidateIds: string[], n: number) {
    const q = mockEmbedding(queryText);
    const ids = new Set(candidateIds);
    return load()
      .resources.filter((r) => ids.has(r.id))
      .map((r) => ({ id: r.id, s: cosine(q, embeddingFor(r)) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, n)
      .map((x) => x.id);
  }

  async listCatalog(churchId: string): Promise<CatalogEntry[]> {
    return load()
      .catalog.filter((c) => c.church_id === churchId)
      .map(({ church_id: _c, ...e }) => e);
  }
  async upsertCatalogEntry(churchId: string, entry: CatalogEntry) {
    const db = load();
    const existing = db.catalog.find((c) => c.church_id === churchId && c.resource_id === entry.resource_id);
    if (existing) Object.assign(existing, entry);
    else db.catalog.push({ church_id: churchId, ...entry });
    save();
  }

  async listRecommendations(seasonId: string) {
    return load()
      .recommendations.filter((r) => r.season_id === seasonId)
      .sort((a, b) => a.rank - b.rank);
  }
  async replaceRecommendations(seasonId: string, rows: Omit<RecommendationRow, "id" | "season_id" | "created_at" | "feedback">[]) {
    const db = load();
    db.recommendations = db.recommendations.filter((r) => r.season_id !== seasonId);
    for (const row of rows) db.recommendations.push({ ...row, id: randomUUID(), season_id: seasonId, created_at: now(), feedback: null });
    save();
  }
  async getRecommendation(id: string) {
    return load().recommendations.find((r) => r.id === id) ?? null;
  }
  async addFeedback(id: string, fb: { action: "picked" | "dismissed"; rating?: number | null; comment?: string | null }) {
    const r = load().recommendations.find((x) => x.id === id);
    if (!r) return;
    r.feedback = { action: fb.action, rating: fb.rating ?? r.feedback?.rating ?? null, comment: fb.comment ?? r.feedback?.comment ?? null };
    save();
  }
  async pickedResourceIds(groupId: string, excludeSeasonId: string) {
    const db = load();
    const seasonIds = new Set(db.seasons.filter((s) => s.group_id === groupId && s.id !== excludeSeasonId).map((s) => s.id));
    return db.recommendations.filter((r) => seasonIds.has(r.season_id) && r.feedback?.action === "picked").map((r) => r.resource_id);
  }

  async listSessionPlans(seasonId: string) {
    return load()
      .plans.filter((p) => p.season_id === seasonId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async saveSessionPlan(input: Omit<SessionPlanRow, "id" | "created_at">) {
    const row: SessionPlanRow = { ...input, id: randomUUID(), created_at: now() };
    load().plans.push(row);
    save();
    return row;
  }
}
