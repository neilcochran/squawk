import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import nodePlugin from 'eslint-plugin-n';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

import { sharedImportConfig } from '../../eslint.shared.mjs';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    plugins: { n: nodePlugin },
    rules: {
      'n/no-deprecated-api': 'error',
      'n/no-process-exit': 'warn',
      'n/no-unsupported-features/es-builtins': 'error',
      'n/no-unsupported-features/node-builtins': 'error',
      'n/prefer-node-protocol': 'error',
    },
  },
  sharedImportConfig,
  prettierConfig,
);
