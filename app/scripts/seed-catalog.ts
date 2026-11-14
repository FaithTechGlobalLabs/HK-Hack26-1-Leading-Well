/**
 * Seed the global resource catalog: BibleProject JSON + RightNow Media CSV
 *   -> auto-tag (OpenAI, or offline keyword tagger when no key / MOCK_AI=1)
 *   -> embed (text-embedding-3-small, or deterministic mock embedding)
 *   -> upsert into Supabase (church_id = null, tag_status = "ai" for pastor review).
 *
 * Usage:  npm run seed:catalog [-- --dry-run] [-- --limit 10]
 * Without Supabase env vars it runs as a dry run and prints a summary.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { aiEnabled, embed, tagResource } from "../src/lib/ai";
import { loadCatalogSeeds } from "../src/lib/catalog/load";
import { offlineTags, resourceEmbeddingText, type CatalogSeed } from "../src/lib/catalog/parse";
import type { ResourceTag } from "../src/lib/engine/recommend";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function tagAll(seeds: CatalogSeed[]): Promise<ResourceTag[][]> {
  const out: ResourceTag[][] = [];
  for (const [i, s] of seeds.entries()) {
    out.push(aiEnabled() ? await tagResource(s, s.hint_tags) : offlineTags(s));
    if ((i + 1) % 25 === 0) console.log(`  tagged ${i + 1}/${seeds.length}`);
  }
  return out;
}

async function embedAll(seeds: CatalogSeed[], tags: ResourceTag[][]): Promise<number[][]> {
  const out: number[][] = [];
  const batch = 64;
  for (let i = 0; i < seeds.length; i += batch) {
    const texts = seeds.slice(i, i + batch).map((s, j) => resourceEmbeddingText({ ...s, tags: tags[i + j] }));
    out.push(...(await embed(texts)));
  }
  return out;
}

async function main() {
  const limit = Number(opt("limit") ?? 0);
  let seeds = loadCatalogSeeds();
  if (limit > 0) seeds = seeds.slice(0, limit);
  const hasDb = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = flag("dry-run") || !hasDb;

  const bySource = seeds.reduce<Record<string, number>>((acc, s) => ((acc[s.source] = (acc[s.source] ?? 0) + 1), acc), {});
  const unverified = seeds.filter((s) => s.url_verified === false).length;
  console.log(`Loaded ${seeds.length} resources`, bySource, `(${unverified} with unverified URLs)`);
  console.log(`Tagging with ${aiEnabled() ? "OpenAI" : "offline keyword tagger (mock)"}...`);
  const tags = await tagAll(seeds);
  console.log("Embedding...");
  const embeddings = await embedAll(seeds, tags);

  if (dryRun) {
    const untagged = tags.filter((t) => t.length === 0).length;
    console.log(`Dry run${hasDb ? "" : " (no NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"}: ` +
      `${seeds.length} resources, ${tags.flat().length} tags (${untagged} untagged), ${embeddings[0]?.length ?? 0}-d embeddings. Nothing written.`);
    return;
  }

  const { createSupabaseServiceClient } = await import("../src/lib/supabase/admin");
  const { SupabaseRepo } = await import("../src/lib/data/supabase");
  const sb = createSupabaseServiceClient();
  const repo = new SupabaseRepo(sb);
  let n = 0;
  for (const [i, s] of seeds.entries()) {
    const { hint_tags: _h, external_id, ...fields } = s;
    const { data, error } = await sb
      .from("resources")
      .upsert(
        { ...fields, church_id: null, external_id: `global:${external_id}`, embedding: JSON.stringify(embeddings[i]), tag_status: "ai" },
        { onConflict: "external_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`${s.title}: ${error.message}`);
    await repo.setResourceTags(data.id, tags[i], "ai");
    n++;
  }
  console.log(`Upserted ${n} global resources. Pastors review AI tags at /pastor/review and allow them in /pastor.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
