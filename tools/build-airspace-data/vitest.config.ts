import { defineProject, mergeConfig } from 'vitest/config';
import { sharedVitestConfig } from '../../vitest.shared.js';

export default mergeConfig(
  sharedVitestConfig,
  defineProject({
    test: {
      name: '@squawk/build-airspace-data',
      coverage: {
        exclude: ['src/index.ts', 'src/parse-class-airspace.ts', 'src/parse-sua.ts'],
      },
    },
  }),
);
