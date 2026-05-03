import importPlugin from 'eslint-plugin-import';

/**
 * Universal eslint-plugin-import configuration. Imported by both the root
 * `eslint.config.mjs` (covers libs, tools, scripts) and `apps/atlas/eslint.config.js`
 * (covers atlas) so both surfaces stay in sync. Update here, not at the call sites.
 *
 * `eslint-plugin-n` is intentionally NOT included here - it is Node-only and only
 * applied by the root config. Atlas (browser code) skips it.
 */
const importResolverSettings = {
  'import/resolver': {
    typescript: { alwaysTryTypes: true },
    node: true,
  },
  'import/parsers': {
    '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'],
  },
};

export const sharedImportConfig = {
  plugins: { import: importPlugin },
  settings: importResolverSettings,
  rules: {
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        pathGroups: [{ pattern: '@squawk/**', group: 'internal' }],
        pathGroupsExcludedImportTypes: ['builtin'],
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-cycle': 'error',
    'import/no-duplicates': 'error',
    'import/no-self-import': 'error',
  },
};

// NOTE: `import/no-unused-modules` is intentionally not configured here.
// The rule has a known incompatibility with ESLint flat config
// (https://github.com/import-js/eslint-plugin-import/issues/3079) - it
// requires a legacy .eslintrc file to enumerate ignored files because it
// uses internal ESLint APIs that flat config no longer exposes. Adding a
// stub .eslintrc just to satisfy this rule would resurrect the legacy
// config format the rest of the repo has moved past.
//
// Source-level dead-export detection is therefore deferred until either
// (a) the upstream rule supports flat config, or (b) an alternative
// (e.g. ts-prune, knip's `nsExports` once it's reliable) is adopted.
// Knip already covers package-level dead deps, unlisted deps, and
// orphaned files - the gap is internal-helper exports that no other file
// in the same package imports.
