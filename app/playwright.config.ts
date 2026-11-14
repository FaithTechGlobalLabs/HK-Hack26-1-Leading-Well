import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const DEMO_DATA_FILE = path.join(os.tmpdir(), `care-group-e2e-${PORT}.json`);
// Start every run from the freshly seeded demo store (main process only, not in workers).
if (!process.env.TEST_WORKER_INDEX) fs.rmSync(DEMO_DATA_FILE, { force: true });

/**
 * Smoke tests run against a production build in offline demo mode:
 * no Supabase or OpenAI env vars, mocked AI, and a throwaway JSON demo store.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Uses installed Google Chrome by default (no download needed); set E2E_BROWSER_CHANNEL="" to use
      // Playwright's bundled Chromium after `npx playwright install chromium`.
      use: { ...devices["Desktop Chrome"], channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome" },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DEMO_DATA_FILE,
      MOCK_AI: "1",
      OPENAI_API_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
