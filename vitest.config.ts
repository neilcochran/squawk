import { defineConfig } from 'vitest/config';

/**
 * Root Vitest config. Aggregates every workspace's per-package config via the
 * `projects` field so a single `vitest run` (or `vitest run --coverage`) at the
 * repo root exercises the entire monorepo. Each project owns its own
 * environment, setup files, and threshold overrides; the shared defaults live
 * in `vitest.shared.ts`.
 */
export default defineConfig({
  test: {
    projects: [
      'packages/libs/*/vitest.config.ts',
      'tools/*/vitest.config.ts',
      'apps/atlas/vite.config.ts',
    ],
  },
});
