import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

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
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: globals.nodeBuiltin,
    },
  },
);
