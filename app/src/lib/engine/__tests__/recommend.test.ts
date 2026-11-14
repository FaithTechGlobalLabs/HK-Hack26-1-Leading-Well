import { describe, expect, it } from "vitest";
import {
  filterResources,
  mmrSelect,
  reciprocalRankFusion,
  recommend,
  scoreResource,
  SCORE_WEIGHTS,
  type CatalogEntry,
  type RecommendContext,
  type Resource,
} from "../recommend";
import type { GroupNeedProfile, TagNeed } from "../needs";
import { mockEmbedding, needsSummarySentence } from "../text";

const res = (id: string, tags: [string, number][], over: Partial<Resource> = {}): Resource => ({
  id,
  source: "bibleproject",
  title: id,
  description: tags.map((t) => t[0]).join(" "),
  url: `https://example.org/${id}`,
  language: ["en"],
  units: 1,
  minutes_per_unit: 8,
  depth: 2,
  format: "video",
  has_guide: false,
  access: "free",
  tags: tags.map(([tag, relevance]) => ({ tag, relevance })),
  ...over,
});

const tn = (tag: string, need: number, interestShare = 0, count = 0): TagNeed => ({
  tag,
  need,
  prevalence: 0,
  mean: 0,
  urgency: 0,
  count,
  interestShare,
  interestCount: 0,
});

const profile = (needs: TagNeed[], over: Partial<GroupNeedProfile> = {}): GroupNeedProfile => ({
  n: 8,
  needs: [...needs].sort((a, b) => b.need - a.need),
  hiddenNeeds: [],
  depthTarget: 2,
  masterySpread: 0.2,
  tieredQuestions: false,
  formatShare: { video: 1 },
  medianPrepMinutes: 15,
  ...over,
});

const allow = (ids: string[], priority = 0.5): CatalogEntry[] =>
  ids.map((resource_id) => ({ resource_id, status: "allowed", priority }));

const ctx = (p: GroupNeedProfile, over: Partial<RecommendContext> = {}): RecommendContext => ({
  profile: p,
  locale: "en",
  hasRightNowAccess: false,
  targetWeeks: 6,
  recentlyUsed: [],
  previouslyCoveredTags: [],
  ...over,
});

describe("filter", () => {
  it("applies allowlist, block, subscription, units and recently-used filters", () => {
    const rs = [
      res("a", [["anxiety", 1]]),
      res("blocked", [["anxiety", 1]]),
      res("sub", [["anxiety", 1]], { access: "subscription", source: "rightnow" }),
      res("long", [["anxiety", 1]], { units: 12 }),
      res("recent", [["anxiety", 1]]),
      res("not-in-catalog", [["anxiety", 1]]),
    ];
    const catalog: CatalogEntry[] = [
      ...allow(["a", "sub", "long", "recent"]),
      { resource_id: "blocked", status: "blocked", priority: 1 },
    ];
    const r = filterResources(rs, catalog, { locale: "en", hasRightNowAccess: false, targetWeeks: 6, recentlyUsed: ["recent"] });
    expect(r.eligible.map((x) => x.id)).toEqual(["a"]);
    const withSub = filterResources(rs, catalog, { locale: "en", hasRightNowAccess: true, targetWeeks: 6, recentlyUsed: [] });
    expect(withSub.eligible.map((x) => x.id).sort()).toEqual(["a", "recent", "sub"]);
  });

  it("relaxes the language filter when too few resources match", () => {
    const rs = [res("a", []), res("b", []), res("c", [], { language: ["en", "zh-Hant"] })];
    const r = filterResources(rs, allow(["a", "b", "c"]), { locale: "zh-Hant", hasRightNowAccess: false, targetWeeks: 4, recentlyUsed: [] });
    expect(r.eligible).toHaveLength(3);
    expect(r.relaxedLanguage).toBe(true);
  });
});

describe("reciprocal rank fusion", () => {
  it("sums 1/(k+rank) across rankings", () => {
    const s = reciprocalRankFusion([["a", "b"], ["b", "c"]], 60);
    expect(s.get("a")).toBeCloseTo(1 / 61);
    expect(s.get("b")).toBeCloseTo(1 / 62 + 1 / 61);
    expect(s.get("c")).toBeCloseTo(1 / 62);
    expect([...s.entries()].sort((x, y) => y[1] - x[1])[0][0]).toBe("b");
  });
});

describe("scoring", () => {
  it("uses the 0.40/0.15/0.15/0.15/0.10/-0.05 weights", () => {
    const p = profile([tn("anxiety", 0.8, 0.5, 5), tn("prayer", 0.4)]);
    const r = res("x", [["anxiety", 1]], { depth: 2, format: "video" });
    const b = scoreResource(r, ctx(p, { previouslyCoveredTags: ["anxiety"] }), { resource_id: "x", status: "allowed", priority: 1 }, 0);
    expect(b.coverage).toBeCloseTo(0.8 / 1.2);
    expect(b.depthFit).toBe(1);
    expect(b.interest).toBeCloseTo(0.5);
    expect(b.priority).toBe(1);
    expect(b.formatFit).toBe(1);
    expect(b.repetition).toBe(1);
    expect(b.total).toBeCloseTo(
      SCORE_WEIGHTS.coverage * (0.8 / 1.2) + 0.15 * 1 + 0.15 * 0.5 + 0.15 * 1 + 0.1 * 1 - 0.05 * 1,
    );
    expect(b.coveredTags[0]).toMatchObject({ tag: "anxiety", count: 5 });
  });

  it("penalises depth mismatch", () => {
    const p = profile([tn("anxiety", 0.8)], { depthTarget: 1 });
    expect(scoreResource(res("x", [["anxiety", 1]], { depth: 3 }), ctx(p), undefined, 0).depthFit).toBe(0);
  });
});

describe("MMR", () => {
  it("trades relevance for diversity", () => {
    const items = [
      { id: "a1", rel: 1.0, group: "a" },
      { id: "a2", rel: 0.95, group: "a" },
      { id: "b1", rel: 0.7, group: "b" },
    ];
    const sim = (x: (typeof items)[0], y: (typeof items)[0]) => (x.group === y.group ? 1 : 0);
    expect(mmrSelect(items, (x) => x.rel, sim, 2, 0.7).map((x) => x.id)).toEqual(["a1", "b1"]);
    expect(mmrSelect(items, (x) => x.rel, sim, 2, 1).map((x) => x.id)).toEqual(["a1", "a2"]);
  });
});

describe("recommend pipeline", () => {
  it("returns 3-5 varied options covering the top needs", () => {
    const resources = [
      res("anx-1", [["anxiety", 1], ["peace", 0.6]]),
      res("anx-2", [["anxiety", 0.9], ["peace", 0.7]]),
      res("anx-3", [["anxiety", 0.95]]),
      res("ot", [["ot_narrative", 1]]),
      res("rest", [["rest", 1]]),
      res("money", [["money", 1]]),
    ].map((r) => ({ ...r, embedding: mockEmbedding(r.description) }));
    const p = profile([tn("anxiety", 0.9, 0.5, 6), tn("ot_narrative", 0.7, 0.2, 5), tn("rest", 0.6), tn("money", 0.05)]);
    const recs = recommend(resources, allow(resources.map((r) => r.id)), ctx(p, { queryEmbedding: mockEmbedding(needsSummarySentence(p)), k: 4 }));
    expect(recs).toHaveLength(4);
    expect(recs[0].resource.id.startsWith("anx")).toBe(true);
    const ids = recs.map((r) => r.resource.id);
    expect(ids).toContain("ot");
    expect(ids).toContain("rest");
    expect(recs.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(recs.every((r) => r.breakdown.rrf > 0)).toBe(true);
  });
});
