import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["**/*.test.{ts,tsx}"],
    // electron/ is a separate package with its own node_modules (see
    // eslint.config.mjs's matching exclusion) — without this, Vitest's
    // globbing reaches into electron/node_modules/zod's own bundled test
    // suite, which fails for unrelated reasons (missing dev-only deps of
    // zod itself, never installed since we only consume zod, not test it).
    exclude: ["node_modules/**", ".next/**", "generated/**", "e2e/**", "electron/**"],
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "."),
    },
  },
});
