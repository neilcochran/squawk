# @squawk/airspace-data

## 0.5.1

### Patch Changes

- c7e6e12: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

## 0.5.0

### Minor Changes

- 6122b65: ### Added
  - Browser / SPA support on every `@squawk/*-data` package. New `/browser` subpath export with an async `loadUsBundled<X>()` loader that fetches and decompresses the bundled `.gz` using Web Streams (`DecompressionStream`) and the global `fetch`, returning the same dataset shape the Node entry exports. Works in browsers, Cloudflare Workers, Deno Deploy, and any runtime without `node:fs`. Pair with the corresponding logic package (`@squawk/airports`, `@squawk/airspace`, etc.) for zero-config SPA usage. The Node entry (`@squawk/<pkg>`) is unchanged; existing `import { usBundled<X> } from '@squawk/<pkg>'` calls keep working.
  - `Load<X>DatasetOptions` accepts an optional `url` (default resolves relative to `import.meta.url`, which any modern ESM bundler rewrites as a hashed asset URL when the package is installed normally) and an optional `fetch` (useful for tests, configured fetchers, or edge runtimes).
  - The browser loader handles transport-level gzip: when a server advertises `Content-Encoding: gzip` (Vite's preview server, nginx with `gzip_static on`, many CDNs), `fetch()` decodes the body automatically and the loader skips its own `DecompressionStream` step. Servers that serve the `.gz` as opaque bytes still trigger the in-loader decompression.
  - New `/data/<file>.gz` asset subpath exposing the bundled snapshot as a static asset. Use with `new URL('@squawk/<pkg>/data/<file>.gz', import.meta.url)` to host the asset on your own CDN.

  ### Changed
  - On-disk wire format of the bundled `.gz` snapshots in the six non-airspace data packages now uses full field names (e.g. `faaId`, `name`, `facilityType`) instead of the prior abbreviated keys (`id`, `nm`, `ft`). The runtime API (`usBundled<X>` constants, `<X>Dataset` types) is unchanged; this only affects consumers who read the `.gz` files directly. Total gzipped size grew by roughly 5% across the six packages.
  - `@squawk/icao-registry-data` snapshot storage changed from an object map keyed by ICAO hex (`{ "A004B3": {...} }`) to a flat array of `AircraftRegistration` records (`[{ icaoHex: "A004B3", ... }, ...]`). The runtime shape (`usBundledRegistry.records: AircraftRegistration[]`) is unchanged. Build-time deduplication by `icaoHex` (last-write-wins) is preserved.

## 0.4.0

### Minor Changes

- 7152f08: ### Added

  **@squawk/types**
  - New `'ARTCC'` value on the `AirspaceType` union for Air Route Traffic Control Center boundary features.
  - New `ArtccStratum` union (`'LOW' | 'HIGH' | 'UTA' | 'CTA' | 'FIR' | 'CTA/FIR'`) describing the boundary stratum carried on each ARTCC feature.
  - New required `artccStratum: ArtccStratum | null` field on `AirspaceFeature`. Populated for `type === 'ARTCC'`; `null` for all other airspace types. Consumers constructing `AirspaceFeature` objects by hand must now populate the field.

  **@squawk/airspace-data**
  - Bundled GeoJSON snapshot now includes ARTCC lateral boundaries for every FAA-controlled center, sourced from NASR `ARB_BASE.csv` and `ARB_SEG.csv`. Covers LOW/HIGH strata for the 20 CONUS centers and Anchorage (ZAN), the UTA stratum for Oakland (ZOA), and oceanic CTA/FIR strata for ZAK, ZAP, ZHN, ZHU, ZMA, ZSU, and ZWY. Polygons are simplified with Douglas-Peucker at 0.001 deg tolerance and the bundled file grows by roughly 10 KB gzipped.
  - Antimeridian-crossing oceanic boundaries (ZAK and ZAP Pacific FIRs) are split at lon=±180 during the build, so every emitted feature stays within the standard `[-180, 180]` longitude range. A single source stratum can yield multiple features that share the same `(identifier, artccStratum)` pair - mirroring how multi-shape oceanic strata (e.g. ZOA UTA) already work.

  **@squawk/airspace**
  - New `byArtcc(identifier, stratum?)` method on `AirspaceResolver` that returns every ARTCC feature for a three-letter center code (`'ZNY'`, `'ZBW'`, etc.), with an optional stratum filter.
  - `query()` now returns ARTCC features alongside Class B/C/D/E and SUA hits when the queried position falls within a center's stratum. Floor and ceiling on ARTCC features use operational stratum approximations (LOW: SFC to FL180, HIGH: FL180 to FL600, UTA: FL600+, oceanic strata: SFC to unlimited) so altitude-aware queries pick the right stratum.

  **@squawk/mcp**
  - New `find_artcc_for_position` tool returning the ARTCC features (and stratum) containing a given position and altitude. Defaults `altitudeFt` to 0, which selects the LOW stratum and any oceanic CTA/FIR overlays.
  - New `find_artcc_by_identifier` tool returning every ARTCC feature for a center code, with full polygon boundaries and an optional stratum filter.
  - `query_airspace_at_position` now includes ARTCC features in its results, and `'ARTCC'` is a valid value in the `airspaceTypes` filter.

  ### Changed

  **@squawk/airspace**
  - `byAirport(identifier, types?)` now excludes ARTCC features by default, even when an ARTCC code happens to collide with an airport identifier. Use `byArtcc` for center lookups.

## 0.3.2

### Patch Changes

- d52b90b: Update internal npm dependencies

## 0.3.1

### Patch Changes

- 8563ada: Make the bundled data source data more visible in squawk/ data package READMEs

## 0.3.0

### Minor Changes

- 6f91bf8: Update bundled data from FAA NASR cycle effective 2026-04-16

### Patch Changes

- 16d7bf1: Correct READMEs and TSDoc

## 0.2.0

### Minor Changes

- fc890a7: Add @squawk/airspace
- b28de20: Add airspace data build pipeline and @squawk/airspace-data package
- ec14992: Add squawk/fixes and squawk/fix-data
- 893af47: Add squawk Navaid packages
- 53b25b2: Add Class-E support and data to squawk/airspace-data
- c7edad0: Add @squawk/airport-data package

### Patch Changes

- 2df8e41: Add basic sanity tests to @squawk/airspace-data
