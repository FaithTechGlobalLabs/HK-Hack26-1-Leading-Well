import { NEED_TAGS, TAGS, TAG_BY_KEY } from "../taxonomy";
import type { GroupNeedProfile } from "./needs";

export const EMBEDDING_DIMS = 1536;

function tokens(text: string): string[] {
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z]+/g) ?? [];
  // CJK: use character bigrams
  const cjk = (lower.match(/[\u4e00-\u9fff]+/g) ?? []).flatMap((run) => {
    const out: string[] = [];
    for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
    if (run.length === 1) out.push(run);
    return out;
  });
  return [...words.filter((w) => w.length > 2), ...cjk];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic offline embedding (feature hashing of words + tag keyword expansion).
 * Used when OPENAI_API_KEY is not set so retrieval still works in demos and tests.
 */
export function mockEmbedding(text: string, dims = EMBEDDING_DIMS): number[] {
  const v = new Array<number>(dims).fill(0);
  const toks = tokens(text);
  for (const t of toks) {
    const h = hash(t);
    v[h % dims] += h & 1 ? 1 : -1;
  }
  // Expand with matching tag keys so "worry" and "anxiety" land close together.
  for (const tag of keywordTags(text)) {
    const h = hash(`tag:${tag.tag}`);
    v[h % dims] += 3 * tag.relevance;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

/** Offline keyword tagger: matches tag keys, labels and keywords (EN + ZH). */
export function keywordTags(text: string, allowed: string[] = NEED_TAGS): { tag: string; relevance: number }[] {
  const lower = ` ${text.toLowerCase()} `;
  const out: { tag: string; relevance: number }[] = [];
  for (const t of TAGS) {
    if (!allowed.includes(t.key)) continue;
    const terms = [t.label_en.toLowerCase(), t.label_zh, ...(t.keywords ?? [])];
    let hits = 0;
    for (const term of terms) {
      const isCjk = /[\u4e00-\u9fff]/.test(term);
      if (isCjk ? lower.includes(term) : new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower)) hits++;
    }
    if (hits) out.push({ tag: t.key, relevance: Math.min(1, 0.5 + 0.2 * hits) });
  }
  return out.sort((a, b) => b.relevance - a.relevance);
}

/** Sentence describing the group's top needs, embedded for vector retrieval. */
export function needsSummarySentence(profile: GroupNeedProfile, top = 6): string {
  const parts = profile.needs
    .slice(0, top)
    .filter((t) => t.need > 0)
    .map((t) => TAG_BY_KEY[t.tag]?.label_en ?? t.tag);
  const depth = ["", "beginner-friendly", "intermediate", "in-depth"][profile.depthTarget];
  return `A ${depth} small-group study about ${parts.join(", ")}.`;
}
