/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Protomaps Hosted API key for the basemap tile source. Supplied per
   * environment - a localhost-restricted key in a gitignored local env
   * file for `npm run dev`, and a deploy-injected key in production. When
   * unset, basemap tile requests are rejected and the basemap renders
   * blank (chart overlays are unaffected).
   */
  readonly VITE_PROTOMAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
