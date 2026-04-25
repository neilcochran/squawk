---
'@squawk/airport-data': minor
'@squawk/airspace-data': minor
'@squawk/airway-data': minor
'@squawk/fix-data': minor
'@squawk/icao-registry-data': minor
'@squawk/navaid-data': minor
'@squawk/procedure-data': minor
---

### Added

- Browser / SPA support on every `@squawk/*-data` package. New `/browser` subpath export with an async `loadUsBundled<X>()` loader that fetches and decompresses the bundled `.gz` using Web Streams (`DecompressionStream`) and the global `fetch`, returning the same dataset shape the Node entry exports. Works in browsers, Cloudflare Workers, Deno Deploy, and any runtime without `node:fs`. Pair with the corresponding logic package (`@squawk/airports`, `@squawk/airspace`, etc.) for zero-config SPA usage. The Node entry (`@squawk/<pkg>`) is unchanged; existing `import { usBundled<X> } from '@squawk/<pkg>'` calls keep working.
- `Load<X>DatasetOptions` accepts an optional `url` (default resolves relative to `import.meta.url`, which any modern ESM bundler rewrites as a hashed asset URL when the package is installed normally) and an optional `fetch` (useful for tests, configured fetchers, or edge runtimes).
- The browser loader handles transport-level gzip: when a server advertises `Content-Encoding: gzip` (Vite's preview server, nginx with `gzip_static on`, many CDNs), `fetch()` decodes the body automatically and the loader skips its own `DecompressionStream` step. Servers that serve the `.gz` as opaque bytes still trigger the in-loader decompression.
- New `/data/<file>.gz` asset subpath exposing the bundled snapshot as a static asset. Use with `new URL('@squawk/<pkg>/data/<file>.gz', import.meta.url)` to host the asset on your own CDN.

### Changed

- On-disk wire format of the bundled `.gz` snapshots in the six non-airspace data packages now uses full field names (e.g. `faaId`, `name`, `facilityType`) instead of the prior abbreviated keys (`id`, `nm`, `ft`). The runtime API (`usBundled<X>` constants, `<X>Dataset` types) is unchanged; this only affects consumers who read the `.gz` files directly. Total gzipped size grew by roughly 5% across the six packages.
- `@squawk/icao-registry-data` snapshot storage changed from an object map keyed by ICAO hex (`{ "A004B3": {...} }`) to a flat array of `AircraftRegistration` records (`[{ icaoHex: "A004B3", ... }, ...]`). The runtime shape (`usBundledRegistry.records: AircraftRegistration[]`) is unchanged. Build-time deduplication by `icaoHex` (last-write-wins) is preserved.
