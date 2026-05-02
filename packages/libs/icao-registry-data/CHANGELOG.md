# @squawk/icao-registry-data

## 0.8.0

### Minor Changes

- 49b1d6f: ### Changed
  - Refreshed bundled FAA ReleasableAircraft snapshot to the 2026-05-02 release (312,230 records, up from 311,711).

## 0.7.1

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

- Updated dependencies [b47b118]
  - @squawk/types@0.7.1

## 0.7.0

### Minor Changes

- 8904c7b: ### Changed
  - Refreshed bundled FAA ReleasableAircraft snapshot (311,711 records, up from 311,653).

## 0.6.0

### Minor Changes

- 73be796: ### Added
  - Browser / SPA support on every `@squawk/*-data` package. New `/browser` subpath export with an async `loadUsBundled<X>()` loader that fetches and decompresses the bundled `.gz` using Web Streams (`DecompressionStream`) and the global `fetch`, returning the same dataset shape the Node entry exports. Works in browsers, Cloudflare Workers, Deno Deploy, and any runtime without `node:fs`. Pair with the corresponding logic package (`@squawk/airports`, `@squawk/airspace`, etc.) for zero-config SPA usage. The Node entry (`@squawk/<pkg>`) is unchanged; existing `import { usBundled<X> } from '@squawk/<pkg>'` calls keep working.
  - `Load<X>DatasetOptions` accepts an optional `url` (default resolves relative to `import.meta.url`, which any modern ESM bundler rewrites as a hashed asset URL when the package is installed normally) and an optional `fetch` (useful for tests, configured fetchers, or edge runtimes).
  - The browser loader handles transport-level gzip: when a server advertises `Content-Encoding: gzip` (Vite's preview server, nginx with `gzip_static on`, many CDNs), `fetch()` decodes the body automatically and the loader skips its own `DecompressionStream` step. Servers that serve the `.gz` as opaque bytes still trigger the in-loader decompression.
  - New `/data/<file>.gz` asset subpath exposing the bundled snapshot as a static asset. Use with `new URL('@squawk/<pkg>/data/<file>.gz', import.meta.url)` to host the asset on your own CDN.

  ### Changed
  - On-disk wire format of the bundled `.gz` snapshots in the six non-airspace data packages now uses full field names (e.g. `faaId`, `name`, `facilityType`) instead of the prior abbreviated keys (`id`, `nm`, `ft`). The runtime API (`usBundled<X>` constants, `<X>Dataset` types) is unchanged; this only affects consumers who read the `.gz` files directly. Total gzipped size grew by roughly 5% across the six packages.
  - `@squawk/icao-registry-data` snapshot storage changed from an object map keyed by ICAO hex (`{ "A004B3": {...} }`) to a flat array of `AircraftRegistration` records (`[{ icaoHex: "A004B3", ... }, ...]`). The runtime shape (`usBundledRegistry.records: AircraftRegistration[]`) is unchanged. Build-time deduplication by `icaoHex` (last-write-wins) is preserved.

## 0.5.0

### Minor Changes

- c21271d: ### Changed
  - Refreshed bundled FAA ReleasableAircraft snapshot to the 2026-04-25 cycle (311,653 records, up from 311,219).

## 0.4.2

### Patch Changes

- Updated dependencies [32f4925]
  - @squawk/types@0.7.0

## 0.4.1

### Patch Changes

- Updated dependencies [15fa9cf]
  - @squawk/types@0.6.0

## 0.4.0

### Minor Changes

- ff22bd5: Bump `@squawk/types` peer dependency to `^0.4.0` for the procedures CIFP migration. No behavioral changes.

### Patch Changes

- Updated dependencies [ff22bd5]
  - @squawk/types@0.5.0

## 0.3.3

### Patch Changes

- a4ba760: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [a4ba760]
  - @squawk/types@0.3.1

## 0.3.2

### Patch Changes

- 9b4c21b: Update internal npm dependencies
- Updated dependencies [9b4c21b]
  - @squawk/types@0.2.2

## 0.3.1

### Patch Changes

- 6cbc367: Make the bundled data source data more visible in squawk/ data package READMEs

## 0.3.0

### Minor Changes

- cede2af: Update bundled ICAO registry data

### Patch Changes

- fe66cec: Correct READMEs and TSDoc
- Updated dependencies [fe66cec]
  - @squawk/types@0.2.1

## 0.2.0

### Minor Changes

- d7ac351: Add @squawk/icon-registry and @squawk/icao-registry-data
- a409b07: Add @squawk/airport-data package

### Patch Changes

- Updated dependencies [7d0383e]
- Updated dependencies [8edfb9b]
- Updated dependencies [df74bd6]
- Updated dependencies [f92d3e2]
- Updated dependencies [3f23773]
- Updated dependencies [1be39b2]
- Updated dependencies [40f0b9d]
- Updated dependencies [cac443c]
- Updated dependencies [c1e728c]
- Updated dependencies [985f0a8]
- Updated dependencies [4711295]
- Updated dependencies [6af10db]
- Updated dependencies [d554f7c]
- Updated dependencies [d7ac351]
- Updated dependencies [a409b07]
- Updated dependencies [746447f]
- Updated dependencies [ffe41f2]
- Updated dependencies [875fc8b]
  - @squawk/types@0.2.0
