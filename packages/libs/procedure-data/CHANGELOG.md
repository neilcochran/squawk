# @squawk/procedure-data

## 0.7.1

### Patch Changes

- b9ff30c: ### Fixed
  - Fix the broken MIT license badge link in every package README. The relative path was one level too shallow, so on GitHub (and on npm renderers that resolve relative paths against the repo) the badge landed on a non-existent `packages/LICENSE.md` instead of the repo's `LICENSE.md`. The badge now resolves correctly.
  - Fix the broken `Documentation` link in `@squawk/flight-math`'s README. The typedoc URL slug used an underscore (`_squawk_flight_math.html`) instead of the dash form every sibling README uses (`_squawk_flight-math.html`), returning 404. Now points at the live docs page.

- Updated dependencies [b9ff30c]
  - @squawk/types@0.7.2

## 0.7.0

### Minor Changes

- 49b1d6f: ### Changed
  - Refreshed bundled FAA CIFP snapshot to the 2026-05-14 cycle (14,306 procedures: 2,204 SIDs, 1,851 STARs, 10,251 IAPs).

  ### Fixed
  - `properties.cifpCycleDate` now carries the AIRAC cycle effective date (e.g. `2026-05-14`) instead of the FAA file-publish date that appears in the CIFP HDR01 record (e.g. `2026-04-22`). The publish date is typically ~3 weeks before the cycle takes effect, so the previous value made bundled snapshots look ~3 weeks older than the cycle they actually represent. Consumers reading `cifpCycleDate` to display "data current as of" or to compare against AIRAC schedules will now see the correct date.

## 0.6.1

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

- Updated dependencies [b47b118]
  - @squawk/types@0.7.1

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

## 0.5.2

### Patch Changes

- Updated dependencies [32f4925]
  - @squawk/types@0.7.0

## 0.5.1

### Patch Changes

- Updated dependencies [15fa9cf]
  - @squawk/types@0.6.0

## 0.5.0

### Minor Changes

- ff22bd5: Migrate procedure dataset to FAA CIFP (ARINC 424). Adds Instrument Approach Procedures and the full leg model on every SID, STAR, and IAP.

  ### Breaking changes:
  - Data is now sourced from FAA CIFP instead of NASR STARDP.
  - Metadata shape changed: `nasrCycleDate` -> `cifpCycleDate`; `waypointCount` -> `legCount`; added `iapCount`.
  - Records expose `Procedure.identifier` instead of `computerCode`, and use the new `ProcedureLeg` model from `@squawk/types`.

  ### Added:
  - 10,376 Instrument Approach Procedures (IAPs) covering ILS, LOC, LOC backcourse, RNAV, RNAV (RNP), VOR, VOR/DME, NDB, NDB/DME, GLS, LDA, and GPS, with approach transitions and missed-approach sequences.
  - Full ARINC 424 leg model on all 201,710 legs: path terminators, altitude constraints, speed constraints, recommended navaid with theta/rho, RNP value, turn direction, and FAF/MAP/IAF/FACF/fly-over flags.
  - Canadian, Pacific, Caribbean, and South Pacific procedures relevant to US operations, passed through from the FAA CIFP publication.
  - Resolved lat/lon on every leg that references a fix (99.998% coverage).

  Dataset now contains 14,428 procedures totaling 201,710 legs, gzipped to 2.4 MB.

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

- 78f8169: Update bundled data from FAA NASR cycle effective 2026-04-16

### Patch Changes

- fe66cec: Correct READMEs and TSDoc
- Updated dependencies [fe66cec]
  - @squawk/types@0.2.1

## 0.2.0

### Minor Changes

- ba098bd: Add squawk/procedures and squawk/procedure-data packages

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
