/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * PMTiles URL for the basemap source, set in the production deploy to
   * point at a self-hosted PMTiles file or Protomaps' commercial CDN.
   * When unset (e.g. during `npm run dev`), the map falls back to
   * Protomaps' public demo bucket.
   */
  readonly VITE_PMTILES_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
