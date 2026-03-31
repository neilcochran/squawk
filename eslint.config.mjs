import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: globals.nodeBuiltin,
    },
  },
);
