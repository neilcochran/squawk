import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { API_PREFIX, DEFAULT_LISTEN_PORT } from './src/shared/protocol.js';

/**
 * Builds the browser UI into `dist/public/`, next to the compiled server
 * under `dist/server/`, so the published tarball's `dist/` carries both and
 * the CLI can serve the UI from a path relative to itself.
 *
 * `npm run dev:ui` serves the UI with hot reload and proxies the API to an
 * `adsbscope` instance already running on its default port.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      [API_PREFIX]: `http://127.0.0.1:${DEFAULT_LISTEN_PORT}`,
    },
  },
});
