/**
 * Generate synthetic survey responses for a demo group. Responses go through the same
 * server-side pipeline as real submissions (validation -> PII scrub -> free-text analysis).
 *
 * Usage:  npm run demo:responses -- --token <survey_token> [--count 8] [--seed 42]
 *                                   [--knowledge 0.4] [--themes anxiety,rest,ot_narrative]
 * Uses Supabase (service-role key) when configured, otherwise the local demo store
 * (.data/demo-db.json or DEMO_DATA_FILE; the demo season token is "demo").
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { syntheticAnswers } from "../src/lib/engine/synthetic";
import { submitSurvey } from "../src/lib/services";
import type { Repo } from "../src/lib/data/types";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const token = opt("token") ?? "demo";
  const count = Number(opt("count") ?? 8);
  const seed = Number(opt("seed") ?? Date.now() % 100000);
  const knowledge = Number(opt("knowledge") ?? 0.5);
  const themes = opt("themes")?.split(",").map((s) => s.trim()).filter(Boolean);

  let repo: Repo;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createSupabaseServiceClient } = await import("../src/lib/supabase/admin");
    const { SupabaseRepo } = await import("../src/lib/data/supabase");
    repo = new SupabaseRepo(createSupabaseServiceClient());
  } else {
    const { DemoRepo } = await import("../src/lib/data/demo");
    repo = new DemoRepo();
  }

  const members = syntheticAnswers(count, { seed, knowledge, themes });
  let ok = 0;
  let crisis = 0;
  for (const m of members) {
    const res = await submitSurvey(token, { locale: m.locale, answers: m.answers, freeText: m.freeText, shareWithLeader: false }, repo);
    if (!res.ok) throw new Error(`Submission rejected (${res.error}). Is the season with token "${token}" open?`);
    ok++;
    if (res.crisis) crisis++;
  }
  console.log(`Submitted ${ok} synthetic responses to season token "${token}" via ${repo.kind} (${crisis} crisis-flagged).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
