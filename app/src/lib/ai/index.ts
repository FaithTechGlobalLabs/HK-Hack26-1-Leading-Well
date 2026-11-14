import OpenAI from "openai";
import { z } from "zod";
import { NEED_TAGS, TAG_BY_KEY, tagLabel } from "../taxonomy";
import { keywordCrisis } from "../engine/pii";
import { keywordTags, mockEmbedding } from "../engine/text";
import type { Recommendation, Resource, ResourceTag } from "../engine/recommend";
import type { GroupNeedProfile } from "../engine/needs";
import { mockRationale, mockSessionPlan, type Rationale, type SessionPlan } from "./mock";

export type { Rationale, SessionPlan } from "./mock";

const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

let client: OpenAI | null = null;
export function aiEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY && process.env.MOCK_AI !== "1";
}
function openai(): OpenAI {
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

async function structured<T>(name: string, schema: object, zod: z.ZodType<T>, system: string, user: string): Promise<T> {
  const res = await openai().chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema: schema as Record<string, unknown> } },
  });
  const content = res.choices[0]?.message?.content ?? "{}";
  return zod.parse(JSON.parse(content));
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  if (!aiEnabled()) return texts.map((t) => mockEmbedding(t));
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const res = await openai().embeddings.create({ model: EMBED_MODEL, input: texts.slice(i, i + 100) });
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tagging (resources + member free text)
// ---------------------------------------------------------------------------

const tagSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tags"],
  properties: {
    tags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tag", "relevance"],
        properties: { tag: { type: "string", enum: NEED_TAGS }, relevance: { type: "number" } },
      },
    },
  },
};
const tagZod = z.object({ tags: z.array(z.object({ tag: z.string(), relevance: z.number() })) });

const taxonomyText = () => NEED_TAGS.map((k) => `${k}: ${TAG_BY_KEY[k].label_en}`).join("\n");

function cleanTags(tags: ResourceTag[], max: number): ResourceTag[] {
  const seen = new Set<string>();
  return tags
    .filter((t) => NEED_TAGS.includes(t.tag) && !seen.has(t.tag) && seen.add(t.tag))
    .map((t) => ({ tag: t.tag, relevance: Math.min(1, Math.max(0, t.relevance)) }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, max);
}

/** Tag a catalog resource. `hints` are curator-supplied tag keys that seed the result. */
export async function tagResource(r: Pick<Resource, "title" | "description">, hints: string[] = []): Promise<ResourceTag[]> {
  const hinted = hints.filter((h) => NEED_TAGS.includes(h)).map((tag, i) => ({ tag, relevance: Math.max(0.6, 1 - i * 0.15) }));
  if (!aiEnabled()) {
    const kw = keywordTags(`${r.title} ${r.description}`).map((t) => ({ ...t, relevance: t.relevance * 0.8 }));
    return cleanTags([...hinted, ...kw], 5);
  }
  try {
    const out = await structured(
      "resource_tags",
      tagSchema,
      tagZod,
      `You tag Christian small-group study resources with a fixed taxonomy. Return 1-5 tags with relevance 0-1 (1 = central theme). Only use these keys:\n${taxonomyText()}`,
      `Title: ${r.title}\nDescription: ${r.description}\nCurator hints: ${hints.join(", ") || "none"}`,
    );
    return cleanTags([...hinted, ...out.tags], 5);
  } catch (e) {
    console.error("tagResource failed, using keyword fallback", e);
    return cleanTags([...hinted, ...keywordTags(`${r.title} ${r.description}`)], 5);
  }
}

const freeTextSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tags", "crisis"],
  properties: { ...tagSchema.properties, crisis: { type: "boolean" } },
};
const freeTextZod = tagZod.extend({ crisis: z.boolean() });

/**
 * Analyse already PII-scrubbed free text: map to taxonomy needs and run the crisis classifier.
 * The keyword crisis check always runs as a safety net.
 */
export async function analyseFreeText(scrubbed: string): Promise<{ needs: Record<string, number>; crisis: boolean }> {
  const text = scrubbed.trim();
  if (!text) return { needs: {}, crisis: false };
  const kwCrisis = keywordCrisis(text);
  let tags: ResourceTag[] = keywordTags(text).map((t) => ({ ...t, relevance: 0.6 }));
  let crisis = kwCrisis;
  if (aiEnabled()) {
    try {
      const out = await structured(
        "free_text_analysis",
        freeTextSchema,
        freeTextZod,
        `You read anonymous survey comments from church small-group members (English or Traditional Chinese). ` +
          `1) Return 0-4 taxonomy tags describing needs expressed, relevance 0-1. Only use these keys:\n${taxonomyText()}\n` +
          `2) Set crisis=true if the text suggests risk of suicide, self-harm, abuse or immediate danger.`,
        text,
      );
      tags = out.tags;
      crisis = kwCrisis || out.crisis;
    } catch (e) {
      console.error("analyseFreeText failed, using keyword fallback", e);
    }
  }
  const needs: Record<string, number> = {};
  for (const t of cleanTags(tags, 4)) needs[t.tag] = t.relevance;
  return { needs, crisis };
}

// ---------------------------------------------------------------------------
// Explanations + session plans
// ---------------------------------------------------------------------------

const rationaleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["resource_id", "rationale_en", "rationale_zh"],
        properties: { resource_id: { type: "string" }, rationale_en: { type: "string" }, rationale_zh: { type: "string" } },
      },
    },
  },
};
const rationaleZod = z.object({ items: z.array(z.object({ resource_id: z.string(), rationale_en: z.string(), rationale_zh: z.string() })) });

export async function explainRecommendations(recs: Recommendation[], profile: GroupNeedProfile): Promise<Rationale[]> {
  const fallback = recs.map((r) => mockRationale(r, profile));
  if (!aiEnabled() || !recs.length) return fallback;
  const facts = recs.map((r) => ({
    resource_id: r.resource.id,
    title: r.resource.title,
    units: r.resource.units,
    depth: r.resource.depth,
    covers: r.breakdown.coveredTags.map((t) => ({ topic: tagLabel(t.tag, "en"), topic_zh: tagLabel(t.tag, "zh-Hant"), members_with_need: t.count })),
  }));
  try {
    const out = await structured(
      "rationales",
      rationaleSchema,
      rationaleZod,
      `You explain to a small-group leader why each resource was recommended. Use ONLY the facts provided — never invent members, numbers or resources. ` +
        `Group size: ${profile.n} members. Cite counts as "X of ${profile.n} members". One or two sentences each, warm and concise. ` +
        `Give English and Traditional Chinese (Hong Kong) versions.`,
      JSON.stringify(facts),
    );
    const allowed = new Set(recs.map((r) => r.resource.id));
    const byId = new Map(out.items.filter((i) => allowed.has(i.resource_id)).map((i) => [i.resource_id, i]));
    return fallback.map((f) => byId.get(f.resource_id) ?? f);
  } catch (e) {
    console.error("explainRecommendations failed, using template", e);
    return fallback;
  }
}

const strArr = { type: "array", items: { type: "string" } };
const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "opener", "scripture", "questions", "application", "prayer_focus"],
  properties: {
    title: { type: "string" },
    opener: { type: "string" },
    scripture: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["reference", "note"], properties: { reference: { type: "string" }, note: { type: "string" } } },
    },
    questions: {
      type: "object",
      additionalProperties: false,
      required: ["beginner", "growing", "mature"],
      properties: { beginner: strArr, growing: strArr, mature: strArr },
    },
    application: { type: "string" },
    prayer_focus: { type: "string" },
  },
};
const planZod = z.object({
  title: z.string(),
  opener: z.string(),
  scripture: z.array(z.object({ reference: z.string(), note: z.string() })),
  questions: z.object({ beginner: z.array(z.string()), growing: z.array(z.string()), mature: z.array(z.string()) }),
  application: z.string(),
  prayer_focus: z.string(),
});

export async function generateSessionPlan(resource: Resource, profile: GroupNeedProfile, locale: string): Promise<SessionPlan> {
  if (!aiEnabled()) return mockSessionPlan(resource, profile, locale);
  const zh = locale.startsWith("zh");
  const needs = profile.needs.slice(0, 6).map((t) => `${tagLabel(t.tag, "en")} (${t.count} of ${profile.n})`);
  try {
    return await structured(
      "session_plan",
      planSchema,
      planZod,
      `You help a church small-group leader plan one session using a specific resource. Do not quote or reproduce the resource's content; refer to it. ` +
        `Write in ${zh ? "Traditional Chinese (Hong Kong)" : "English"}. Provide: an opener question, 1-3 scripture references with a short note, ` +
        `discussion questions in three tiers (beginner, growing, mature; 2-3 each), one application step and a prayer focus. ` +
        `Keep it pastoral, never diagnose individuals, never mention individual members.`,
      `Resource: ${resource.title}\nDescription: ${resource.description}\nGroup needs: ${needs.join(", ")}\nDepth target: ${profile.depthTarget}/3\nTiered questions needed: ${profile.tieredQuestions}`,
    );
  } catch (e) {
    console.error("generateSessionPlan failed, using template", e);
    return mockSessionPlan(resource, profile, locale);
  }
}
