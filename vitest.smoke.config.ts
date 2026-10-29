import { defineConfig } from "vitest/config";
import path from "node:path";

// Live checks against the real services configured in .env.local. Run with `pnpm smoke`.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.smoke.ts"],
    testTimeout: 60_000,
    // One at a time: the end-to-end check writes to the database.
    fileParallelism: false,
  },
});
