import { defineConfig, mergeConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import tsrConfig from './tsr.config.json';
import { sharedVitestConfig } from '../../vitest.shared.js';

/**
 * Atlas Vite + Vitest config. Vite plugins (TanStack Router, React, Tailwind)
 * stay declared inline because the test runner inherits the same Vite plugin
 * pipeline. The Vitest portion is merged on top of the monorepo's
 * `vitest.shared.ts` so the V8 coverage provider, reporter list, and
 * per-file thresholds stay aligned across libs, tools, and atlas. Only the
 * atlas-specific bits (jsdom environment, RTL setup file, generated and
 * map-canvas files excluded from coverage) are declared here.
 */
export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    plugins: [tanstackRouter(tsrConfig), react(), tailwindcss()],
    test: {
      name: 'squawk-atlas',
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      coverage: {
        exclude: [
          'src/test-setup.ts',
          'src/routeTree.gen.ts',
          'src/main.tsx',
          'src/vite-env.d.ts',
          'src/routes/**',
          'src/shared/map/map-canvas.tsx',
          'src/modes/chart/inspectable-cursor.tsx',
          'src/modes/chart/view-reset-listener.tsx',
          'src/modes/chart/layers/airspace-hatch-pattern.ts',
          'src/modes/chart/layers/use-top-of-stack.ts',
          // The chip-hover pan hook drives MapLibre camera behavior in
          // response to selection-change side effects. Its exported
          // helpers (isPointOutsideComfortableArea, panTo...,
          // restoreCenter, getMapInstance) are unit-tested in
          // `use-chip-hover-pan.spec.ts`; the React state machine
          // around them needs a fully-staged map fixture to exercise -
          // more harness than the per-file gate is worth.
          'src/shared/inspector/use-chip-hover-pan.ts',
        ],
      },
    },
  }),
);
