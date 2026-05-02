import { defineProject, mergeConfig } from 'vitest/config';
import { sharedVitestConfig } from '../../../vitest.shared.js';

export default mergeConfig(
  sharedVitestConfig,
  defineProject({
    test: {
      name: '@squawk/icao-registry-data',
    },
  }),
);
