import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest configuration consumed via `mergeConfig` by every per-package
 * config in the monorepo. Centralises the V8 coverage provider, reporter list,
 * default include/exclude globs, and per-file coverage thresholds so each
 * workspace only has to set its own `test.name`.
 *
 * Coverage gating is layered:
 *
 * - Per-file (this config): every covered file must hit 80% on every metric.
 *   Vitest's `perFile: true` makes the `lines` / `functions` / `branches` /
 *   `statements` thresholds apply per-file rather than aggregate.
 * - Aggregate (`scripts/check-coverage.js`): per-package totals must hit 90%
 *   lines / 90% functions / 90% branches, read from each package's
 *   `coverage/coverage-summary.json`. Vitest cannot express both a per-file
 *   and an aggregate gate in one threshold block, so the aggregate gate stays
 *   in a small post-coverage script. The root `npm run test:coverage` script
 *   chains it after `turbo run test:coverage`, so both gates run as one
 *   command; `npm run check-coverage` remains available for re-running just
 *   the aggregate check against existing coverage data.
 *
 * The `json-summary` reporter is enabled here so every package emits the
 * file the aggregate gate reads.
 *
 * Spec files import `describe` / `it` / `beforeAll` / `expect` directly from
 * `vitest`; globals are intentionally disabled to keep call sites grep-friendly
 * and to align with the policy already used by `apps/atlas`.
 */
export const sharedVitestConfig = defineConfig({
  test: {
    globals: false,
    include: ['src/**/*.spec.{ts,tsx}'],
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**'],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.d.ts',
        'src/test-utils.ts',
        'dist/**',
        'coverage/**',
      ],
      thresholds: {
        perFile: true,
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
