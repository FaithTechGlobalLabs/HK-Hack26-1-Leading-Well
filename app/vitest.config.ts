import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    environment: "node",
    env: { OPENAI_API_KEY: "", NEXT_PUBLIC_SUPABASE_URL: "" },
  },
});
