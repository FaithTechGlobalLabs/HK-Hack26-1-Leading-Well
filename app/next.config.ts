import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The catalog seed files are read at runtime by the demo store.
  outputFileTracingIncludes: {
    "/**": ["./data/**/*"],
  },
};

export default withNextIntl(nextConfig);