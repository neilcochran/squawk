import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import nodePlugin from 'eslint-plugin-n';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { sharedImportConfig } from './eslint.shared.mjs';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'scripts/*.js'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: globals.nodeBuiltin,
    },
  },
  sharedImportConfig,
  {
    files: ['packages/libs/**/*.{ts,mts}', 'tools/**/*.{ts,mts}', 'scripts/**/*.{js,mjs}'],
    plugins: { n: nodePlugin },
    rules: {
      'n/no-deprecated-api': 'error',
      'n/no-process-exit': 'warn',
      'n/no-unsupported-features/es-builtins': 'error',
      'n/no-unsupported-features/node-builtins': 'error',
      'n/prefer-node-protocol': 'error',
    },
  },
);
