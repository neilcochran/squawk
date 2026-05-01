/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import tsrConfig from './tsr.config.json';

export default defineConfig({
  plugins: [tanstackRouter(tsrConfig), react(), tailwindcss()],
  // Vitest config lives alongside the Vite config so tests inherit the
  // same plugin pipeline (TanStack Router, Tailwind, etc.). `jsdom`
  // gives test code a DOM so React Testing Library can mount components.
  // The setup file registers `@testing-library/jest-dom` matchers
  // (`toBeInTheDocument`, `toHaveClass`, etc.) globally.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
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
      ],
    },
  },
});
