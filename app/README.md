# Care Group Planner (MVP)

This app helps church care group leaders choose and prepare study material.
Members take a short anonymous survey (EN / 繁中). The app then:
- computes the group's Bible knowledge gaps and life needs;
- recommends resources from a pastor-curated catalog (BibleProject and RightNow Media);
- drafts a session plan with tiered questions.

## Quick start (offline demo, no credentials needed)

```bash
cd app
npm install
npm run dev        # http://localhost:3000
```

With no Supabase or OpenAI environment variables set, the app runs in **demo mode**:
- Data lives in a local JSON store at `.data/demo-db.json`.
- AI calls use a deterministic mock.
- The demo store is seeded with a church, a group and 8 synthetic survey responses.
- The catalog comes from `data/bibleproject.json` and `data/rightnow-sample.csv`.

To try it, use the buttons on the landing page:
- "Continue as a leader" / "Continue as a pastor".
- The member survey is at `/s/demo`.
- "Reset demo data" restores the seeded state.

## Scripts

| Command | Purpose |
|---|---|
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm test` | Vitest: engine (needs, scoring, RRF, MMR), PII scrub, CSV parsing, i18n key coverage |
| `npm run build` | Production build |
| `npm run e2e` | Playwright smoke test (survey → dashboard → recommendations → session plan). Builds and starts the app in offline demo mode with mocked AI and a throwaway demo store. Uses installed Google Chrome; set `E2E_BROWSER_CHANNEL=` to use bundled Chromium after `npx playwright install chromium`. |
| `npm run seed:catalog` | Load `data/bibleproject.json` + `data/rightnow-sample.csv` → AI tag (offline keyword tagger without a key) → embed → upsert as global resources. Dry run (prints counts) without Supabase env or with `-- --dry-run`; `-- --limit N` for a subset. |
| `npm run demo:responses -- --token <token> [--count 8] [--knowledge 0.4] [--themes anxiety,rest]` | Submit synthetic survey responses through the normal scrub/analyse pipeline. Uses Supabase with the service-role key when configured, otherwise the local demo store (token `demo`). |

## Production setup (Supabase + OpenAI)

1. Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key, service-role key and `OPENAI_API_KEY`.
2. Apply the schema. Pick one:
   - `supabase db push` with the Supabase CLI;
   - or run the files in `supabase/migrations/` in order in the SQL editor.

   The migration creates:
   - the tables;
   - RLS (pastor sees their own church, leader sees their own groups, responses are inserted only through the token RPC);
   - pgvector and the RPCs `get_survey`, `submit_survey_response`, `match_resources`, `create_church` and `join_church`.
3. Enable the email (magic link) auth provider. Add `<site>/auth/callback` to the redirect URLs.
4. Load the catalog: `npm run seed:catalog` (needs `SUPABASE_SERVICE_ROLE_KEY`; uses `OPENAI_API_KEY` for tagging/embeddings when set).
   - Pastors can also import their own CSV from `/pastor` (template at `/pastor/template.csv`); imports are auto-tagged and embedded.
   - Review AI tags, then click "Allow all".

  
5. Deploy to Vercel:
   - Root directory `app`.
   - Set the same environment variables.
   - Set `NEXT_PUBLIC_SITE_URL` to the deployed URL.

## How it works

- `src/lib/engine`: pure TypeScript algorithms.
  - **Member need per tag**, in [0, 1]:
    - Knowledge gap = 1 − mastery, where mastery = 0.7 × Beta-shrunk quiz accuracy + 0.3 × confidence.
    - Situational need comes from emotion and life-event intensity.
  - **Group need** = 0.5 × prevalence + 0.3 × mean + 0.2 × max.
  - **Hidden needs**: high need but low interest, or a low leader estimate.
  - **Recommender**:
    1. Filter: allowlist, language, access, length, recent use.
    2. Retrieve with tag overlap and vector search, merged with reciprocal rank fusion.
    3. Weighted score (0.40 coverage, 0.15 depth fit, 0.15 interest, 0.15 pastor priority, 0.10 format fit, −0.05 repetition).
    4. MMR (λ = 0.7) to pick 3–5 varied options.
- `src/lib/ai`: OpenAI structured outputs with mock fallbacks.
  - Resource tagging, free-text tagging and crisis classification, recommendation rationales, session plans.
  - Rationales may only reference the given resource IDs and stats.
- `src/lib/data`: `Repo` abstraction with two implementations: `SupabaseRepo` and `DemoRepo` (JSON file).

## Privacy and safety

- Responses are anonymous by default. A member can opt in to share their name.
- No IP address or user agent is stored.
- Survey submissions only go through the server action, which validates and PII-scrubs before storing. The `submit_survey_response` RPC is executable by `service_role` only (migration `20261114010000_lock_submit_rpc.sql`), so `SUPABASE_SERVICE_ROLE_KEY` must be set on the server.
- Free text is PII-scrubbed before storage and before any LLM call. The scrub covers EN/ZH names, HK phone numbers, HKID and emails.
- Group breakdowns are hidden below 3 responses. Counts are shown instead of percentages below 5.
- Crisis detection (LLM plus a keyword safety net):
  - The member sees HK helplines (Samaritan Befrienders 2389 2222, The Samaritans 2896 0000, Suicide Prevention Services 2382 0000, 999).
  - The leader gets an anonymous flag.

## Content and attribution

- **BibleProject:** catalog entries store only title, description, link and attribution. Videos are free, unmodified, and linked to bibleproject.com.
  - All BibleProject entries are English only.
- **RightNow Media:** metadata and links only; nothing gated is scraped. Members open the content with their church's subscription.
  - In `data/rightnow-sample.csv`, 20 of the 51 rows link to the RightNow Media homepage because their series URLs could not be verified. These rows have `url_verified=false`; the flag is stored on `resources.url_verified` and shown as an "unverified link" badge in the pastor catalog so the link can be replaced.
  - Session counts and lengths are approximate.

## Known limitations / TODO

- Pastors can edit tags on global (shared) resources.
- The demo store on Vercel uses `/tmp`, which is ephemeral per instance.