import { NEED_TAGS, SITUATION_TO_NEEDS } from "../taxonomy";
import type { Resource, ResourceFormat } from "../engine/recommend";
import { parseCsvObjects } from "../csv";
import { keywordTags } from "../engine/text";

/** A catalog item before tagging/embedding, keyed by a stable external id. */
export interface CatalogSeed extends Omit<Resource, "id" | "tags" | "embedding"> {
  external_id: string;
  hint_tags: string[];
  /** False when the link is a placeholder (e.g. the provider's homepage) that a curator should replace. */
  url_verified?: boolean;
}

export const BIBLEPROJECT_ATTRIBUTION =
  "Video by BibleProject (bibleproject.com). Used under BibleProject's free-use terms; content unmodified.";

interface BibleProjectJson {
  id: string;
  title: string;
  title_zh?: string;
  description: string;
  description_zh?: string;
  url: string;
  language?: string[];
  units?: number;
  minutes_per_unit?: number;
  format?: string;
  depth?: number;
  has_guide?: boolean;
  hint_tags?: string[];
  attribution?: string;
}

const fmt = (f: string | undefined): ResourceFormat => (f === "discussion" || f === "reading" ? f : "video");
const depth = (d: unknown): 1 | 2 | 3 => {
  const n = Number(d);
  return n === 1 || n === 3 ? n : 2;
};
/** Keep need tags; expand situation tags (e.g. bereavement) into the needs they imply. */
export function normaliseHints(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    for (const k of NEED_TAGS.includes(t) ? [t] : (SITUATION_TO_NEEDS[t] ?? [])) if (!out.includes(k)) out.push(k);
  }
  return out;
}

const list = (s: string | undefined) =>
  (s ?? "")
    .split(/[;|]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function parseBibleProject(items: BibleProjectJson[]): CatalogSeed[] {
  return items.map((b) => ({
    external_id: b.id,
    source: "bibleproject",
    title: b.title,
    title_zh: b.title_zh ?? null,
    description: b.description,
    description_zh: b.description_zh ?? null,
    url: b.url,
    language: b.language?.length ? b.language : ["en"],
    units: Math.max(1, Number(b.units ?? 1)),
    minutes_per_unit: Number(b.minutes_per_unit ?? 8),
    depth: depth(b.depth ?? 1),
    format: fmt(b.format),
    has_guide: !!b.has_guide,
    access: "free",
    attribution: b.attribution || BIBLEPROJECT_ATTRIBUTION,
    hint_tags: normaliseHints(b.hint_tags ?? []),
  }));
}

export const RESOURCE_CSV_COLUMNS = [
  "external_id", "title", "title_zh", "description", "description_zh", "url", "language",
  "units", "minutes_per_unit", "format", "depth", "has_guide", "hint_tags", "url_verified",
] as const;

/** Parse the RightNow Media (or custom) CSV template. */
export function parseResourceCsv(csv: string, source: "rightnow" | "custom" = "rightnow"): { items: CatalogSeed[]; errors: string[] } {
  const errors: string[] = [];
  const items: CatalogSeed[] = [];
  parseCsvObjects(csv).forEach((row, i) => {
    const line = i + 2;
    if (!row.title || !row.url) {
      errors.push(`Row ${line}: title and url are required`);
      return;
    }
    if (!/^https?:\/\//.test(row.url)) {
      errors.push(`Row ${line}: url must start with http(s)://`);
      return;
    }
    items.push({
      external_id: row.external_id || `${source}-${row.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`,
      source,
      title: row.title,
      title_zh: row.title_zh || null,
      description: row.description ?? "",
      description_zh: row.description_zh || null,
      url: row.url,
      language: list(row.language).length ? list(row.language) : ["en"],
      units: Math.max(1, parseInt(row.units, 10) || 1),
      minutes_per_unit: parseInt(row.minutes_per_unit, 10) || 20,
      depth: depth(row.depth),
      format: fmt(row.format),
      has_guide: /^(true|yes|1)$/i.test(row.has_guide ?? ""),
      access: source === "rightnow" ? "subscription" : "free",
      attribution: source === "rightnow" ? "RightNow Media (rightnowmedia.org) — requires your church's subscription." : null,
      hint_tags: normaliseHints(list(row.hint_tags)),
      url_verified: !/^(false|no|0)$/i.test(row.url_verified ?? ""),
    });
  });
  return { items, errors };
}

/** Offline tagging: curator hints first, then keyword matches. */
export function offlineTags(seed: Pick<CatalogSeed, "title" | "description" | "hint_tags">) {
  const out = new Map<string, number>();
  seed.hint_tags.forEach((t, i) => out.set(t, Math.max(0.6, 1 - i * 0.15)));
  for (const k of keywordTags(`${seed.title} ${seed.description}`)) {
    if (!out.has(k.tag)) out.set(k.tag, Math.min(0.7, k.relevance * 0.8));
  }
  return [...out.entries()]
    .map(([tag, relevance]) => ({ tag, relevance }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);
}

export function resourceEmbeddingText(r: Pick<Resource, "title" | "description" | "tags">): string {
  return `${r.title}. ${r.description} Topics: ${r.tags.map((t) => t.tag.replace(/_/g, " ")).join(", ")}`;
}
