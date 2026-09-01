import { defineProject, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from '../../../vitest.shared.js';

export default mergeConfig(
  sharedVitestConfig,
  defineProject({
    test: {
      name: '@squawk/beast',
      coverage: {
        // Binary Beast-capture fixture, not source - v8 coverage otherwise
        // tries to parse it as JS/TS while remapping uncovered files.
        exclude: ['src/fixtures/**'],
      },
    },
  }),
);
