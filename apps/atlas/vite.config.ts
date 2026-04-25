import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import tsrConfig from './tsr.config.json';

export default defineConfig({
  plugins: [tanstackRouter(tsrConfig), react(), tailwindcss()],
});
