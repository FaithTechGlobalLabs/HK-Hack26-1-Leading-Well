import type { GroupNeedProfile } from "./needs";
import { clamp01 } from "./needs";

export type ResourceSource = "bibleproject" | "rightnow" | "custom";
export type ResourceFormat = "video" | "discussion" | "reading";

export interface ResourceTag {
  tag: string;
  relevance: number;
}

export interface Resource {
  id: string;
  source: ResourceSource;
  title: string;
  title_zh?: string | null;
  description: string;
  description_zh?: string | null;
  url: string;
  language: string[];
  units: number;
  minutes_per_unit: number;
  depth: 1 | 2 | 3;
  format: ResourceFormat;
  has_guide: boolean;
  access: "free" | "subscription";
  attribution?: string | null;
  tags: ResourceTag[];
  embedding?: number[] | null;
}

export interface CatalogEntry {
  resource_id: string;
  status: "allowed" | "blocked";
  priority: number;
  notes?: string | null;
}

export interface RecommendContext {
  profile: GroupNeedProfile;
  locale: string;
  hasRightNowAccess: boolean;
  targetWeeks: number;
  /** Resource ids used by this group recently (excluded). */
  recentlyUsed: string[];
  /** Tags covered by the group's previous picks (used for the repetition penalty). */
  previouslyCoveredTags: string[];
  /** Embedding of the needs-summary sentence (used when resources carry embeddings). */
  queryEmbedding?: number[] | null;
  /** Precomputed vector ranking (e.g. from pgvector), best-first resource ids. Overrides queryEmbedding. */
  vectorRanking?: string[];
  /** Number of recommendations to return (3-5). */
  k?: number;
}

export interface ScoreBreakdown {
  coverage: number;
  depthFit: number;
  interest: number;
  priority: number;
  formatFit: number;
  repetition: number;
  rrf: number;
  total: number;
  coveredTags: { tag: string; need: number; relevance: number; count: number }[];
}

export interface Recommendation {
  resource: Resource;
  score: number;
  breakdown: ScoreBreakdown;
  rank: number;
}

export const SCORE_WEIGHTS = {
  coverage: 0.4,
  depthFit: 0.15,
  interest: 0.15,
  priority: 0.15,
  formatFit: 0.1,
  repetition: 0.05,
};

export const RRF_K = 60;
export const RETRIEVE_N = 50;
export const MMR_LAMBDA = 0.7;
export const DEFAULT_PRIORITY = 0.5;

// ---------- vector utils ----------

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function tagCosine(a: ResourceTag[], b: ResourceTag[]): number {
  const mb = new Map(b.map((t) => [t.tag, t.relevance]));
  let dot = 0;
  for (const t of a) dot += t.relevance * (mb.get(t.tag) ?? 0);
  const na = Math.sqrt(a.reduce((s, t) => s + t.relevance ** 2, 0));
  const nb = Math.sqrt(b.reduce((s, t) => s + t.relevance ** 2, 0));
  return na && nb ? dot / (na * nb) : 0;
}

export function resourceSimilarity(a: Resource, b: Resource): number {
  if (a.embedding?.length && b.embedding?.length) return cosine(a.embedding, b.embedding);
  return tagCosine(a.tags, b.tags);
}

// ---------- 1. filter ----------

export interface FilterResult {
  eligible: Resource[];
  relaxedLanguage: boolean;
}

export function filterResources(
  resources: Resource[],
  catalog: CatalogEntry[],
  ctx: Pick<RecommendContext, "locale" | "hasRightNowAccess" | "targetWeeks" | "recentlyUsed">,
): FilterResult {
  const byId = new Map(catalog.map((c) => [c.resource_id, c]));
  const recent = new Set(ctx.recentlyUsed);
  const base = resources.filter((r) => {
    const entry = byId.get(r.id);
    if (!entry || entry.status !== "allowed") return false;
    if (r.access === "subscription" && !ctx.hasRightNowAccess) return false;
    if (r.units > Math.max(1, ctx.targetWeeks)) return false;
    if (recent.has(r.id)) return false;
    return true;
  });
  const lang = ctx.locale.startsWith("zh") ? "zh-Hant" : "en";
  const sameLang = base.filter((r) => r.language.includes(lang));
  // Many resources only exist in English; relax the language filter rather than return nothing.
  if (sameLang.length >= 3) return { eligible: sameLang, relaxedLanguage: false };
  return { eligible: base, relaxedLanguage: base.length > sameLang.length };
}

// ---------- 2. retrieve + RRF ----------

export function needMap(profile: GroupNeedProfile): Map<string, number> {
  return new Map(profile.needs.map((t) => [t.tag, t.need]));
}

export function tagOverlap(r: Resource, needs: Map<string, number>): number {
  return r.tags.reduce((s, t) => s + (needs.get(t.tag) ?? 0) * t.relevance, 0);
}

/** Return ids ranked best-first. */
export function rankByTagOverlap(resources: Resource[], needs: Map<string, number>, n = RETRIEVE_N): string[] {
  return resources
    .map((r) => ({ id: r.id, s: tagOverlap(r, needs) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.id.localeCompare(b.id))
    .slice(0, n)
    .map((x) => x.id);
}

export function rankByVector(resources: Resource[], query: number[] | null | undefined, n = RETRIEVE_N): string[] {
  if (!query?.length) return [];
  return resources
    .filter((r) => r.embedding?.length)
    .map((r) => ({ id: r.id, s: cosine(query, r.embedding!) }))
    .sort((a, b) => b.s - a.s || a.id.localeCompare(b.id))
    .slice(0, n)
    .map((x) => x.id);
}

/** Reciprocal rank fusion: score(d) = Σ 1 / (k + rank(d)), rank starting at 1. */
export function reciprocalRankFusion(rankings: string[][], k = RRF_K): Map<string, number> {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1)));
  }
  return scores;
}

// ---------- 3. score ----------

export function coverageNormaliser(profile: GroupNeedProfile): number {
  const top = profile.needs.slice(0, 3).reduce((s, t) => s + t.need, 0);
  return top > 0 ? top : 1;
}

export function scoreResource(
  r: Resource,
  ctx: RecommendContext,
  catalogEntry: CatalogEntry | undefined,
  rrf: number,
): ScoreBreakdown {
  const { profile } = ctx;
  const byTag = new Map(profile.needs.map((t) => [t.tag, t]));

  const coveredTags = r.tags
    .map((t) => {
      const gn = byTag.get(t.tag);
      return { tag: t.tag, need: gn?.need ?? 0, relevance: t.relevance, count: gn?.count ?? 0 };
    })
    .filter((t) => t.need > 0)
    .sort((a, b) => b.need * b.relevance - a.need * a.relevance);

  const rawCoverage = coveredTags.reduce((s, t) => s + t.need * t.relevance, 0);
  const coverage = clamp01(rawCoverage / coverageNormaliser(profile));

  const depthFit = clamp01(1 - Math.abs(r.depth - profile.depthTarget) / 2);

  const relSum = r.tags.reduce((s, t) => s + t.relevance, 0);
  const interest = relSum
    ? clamp01(r.tags.reduce((s, t) => s + (byTag.get(t.tag)?.interestShare ?? 0) * t.relevance, 0) / relSum)
    : 0;

  const priority = clamp01(catalogEntry?.priority ?? DEFAULT_PRIORITY);

  const shares = Object.entries(profile.formatShare);
  let formatFit = 0.5;
  if (shares.length) {
    const mixed = profile.formatShare["mixed"] ?? 0;
    formatFit = clamp01((profile.formatShare[r.format] ?? 0) + mixed * 0.5);
  }

  const prev = new Set(ctx.previouslyCoveredTags);
  const repetition = r.tags.length ? r.tags.filter((t) => prev.has(t.tag)).length / r.tags.length : 0;

  const total =
    SCORE_WEIGHTS.coverage * coverage +
    SCORE_WEIGHTS.depthFit * depthFit +
    SCORE_WEIGHTS.interest * interest +
    SCORE_WEIGHTS.priority * priority +
    SCORE_WEIGHTS.formatFit * formatFit -
    SCORE_WEIGHTS.repetition * repetition;

  return { coverage, depthFit, interest, priority, formatFit, repetition, rrf, total, coveredTags: coveredTags.slice(0, 5) };
}

// ---------- 4. MMR ----------

export function mmrSelect<T>(
  items: T[],
  relevance: (x: T) => number,
  similarity: (a: T, b: T) => number,
  k: number,
  lambda = MMR_LAMBDA,
): T[] {
  const pool = [...items];
  const maxRel = Math.max(1e-9, ...pool.map(relevance));
  const selected: T[] = [];
  while (selected.length < k && pool.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    pool.forEach((c, i) => {
      const rel = relevance(c) / maxRel;
      const div = selected.length ? Math.max(...selected.map((s) => similarity(c, s))) : 0;
      const val = lambda * rel - (1 - lambda) * div;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    });
    selected.push(pool.splice(bestIdx, 1)[0]);
  }
  return selected;
}

// ---------- pipeline ----------

export function recommend(resources: Resource[], catalog: CatalogEntry[], ctx: RecommendContext): Recommendation[] {
  const k = Math.min(5, Math.max(3, ctx.k ?? 4));
  const { eligible } = filterResources(resources, catalog, ctx);
  if (!eligible.length) return [];

  const needs = needMap(ctx.profile);
  const byId = new Map(eligible.map((r) => [r.id, r]));
  const vector = ctx.vectorRanking
    ? ctx.vectorRanking.filter((id) => byId.has(id)).slice(0, RETRIEVE_N)
    : rankByVector(eligible, ctx.queryEmbedding);
  const fused = reciprocalRankFusion([rankByTagOverlap(eligible, needs), vector]);
  const catalogById = new Map(catalog.map((c) => [c.resource_id, c]));

  const scored = [...fused.entries()]
    .map(([id, rrf]) => {
      const resource = byId.get(id)!;
      const breakdown = scoreResource(resource, ctx, catalogById.get(id), rrf);
      return { resource, breakdown };
    })
    .sort((a, b) => b.breakdown.total - a.breakdown.total || a.resource.id.localeCompare(b.resource.id));

  const picked = mmrSelect(
    scored,
    (x) => x.breakdown.total,
    (a, b) => resourceSimilarity(a.resource, b.resource),
    k,
  );

  return picked.map((p, i) => ({ resource: p.resource, score: p.breakdown.total, breakdown: p.breakdown, rank: i + 1 }));
}
