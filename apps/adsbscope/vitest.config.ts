import react from '@vitejs/plugin-react';
import { defineProject, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from '../../vitest.shared.js';

/**
 * Server specs run in the default Node environment. UI specs that need a DOM
 * opt into jsdom per file with a `@vitest-environment jsdom` comment, so the
 * pure drawing and formatting specs stay on the faster Node environment. The
 * setup file registers the jest-dom matchers everywhere and DOM cleanup only
 * where there is a DOM.
 */
export default mergeConfig(
  sharedVitestConfig,
  defineProject({
    plugins: [react()],
    test: {
      name: '@squawk/adsbscope',
      setupFiles: ['./src/ui/test-setup.ts'],
      // Process stylesheets for real rather than stubbing them, so the theme contract
      // spec can read them and CSS Module class names are the real ones.
      css: true,
      coverage: {
        exclude: [
          'src/server/cli.ts',
          'src/ui/main.tsx',
          'src/ui/vite-env.d.ts',
          'src/ui/test-setup.ts',
          'src/**/test-utils.ts',
        ],
      },
    },
  }),
);
