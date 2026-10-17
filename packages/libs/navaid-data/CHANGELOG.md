# @squawk/navaid-data

## 0.8.2

### Patch Changes

- 8698c2d: ### Changed

  - The README states the precision of the coordinates and that the same point can differ in its last decimal places between squawk datasets, so positions from different datasets should be compared with a tolerance.

- Updated dependencies [8698c2d]
  - @squawk/types@0.17.0

## 0.8.1

### Patch Changes

- 334a4ee: ### Fixed

  - The 40 navaids not open to public use carry `publicUse: false` instead of leaving it unset, so they can be told apart from records with no flag. `simultaneousVoice` is `false` where the FAA says no and unset only where it says nothing.

- Updated dependencies [334a4ee]
  - @squawk/types@0.16.1

## 0.8.0

### Minor Changes

- 90bbcd5: ### Added

  - `remarks` on 1,057 navaids: 1,921 FAA remarks, more than 1,500 of them unusable sectors given by radial, distance and altitude.
  - `dmeStatus` on the 552 DME, VOR/DME and NDB/DME facilities where the FAA publishes the DME's status separately. It differs from the navaid's own status on 119 of them.
  - `checkpoints`: the 188 VOR receiver checkpoints, on 155 navaids.

  ### Fixed
  - The Thedford VOR/DME (`TDD`) is at its VOR site. The FAA's CSV carries the DME's position in the record's decimal coordinate columns, 0.06 nm away, while the same record's degree, minute and second columns, the FAA's airway data and its procedure data all give the VOR position. The source row was corrected by hand from its own columns before the build, and `dmeLat` / `dmeLon` now carry the DME position.
  - Fan markers no longer carry a magnetic variation. The FAA's record layout says a DME, VOT or fan marker has none and that any value published for one is to be ignored; ten fan markers shipped one.

  ### Changed
  - The README documents the limits of the data: shared identifiers, TACAN frequencies outside the VOR band, what the magnetic variation is, how to read a remark, and which FAA columns are not carried.

### Patch Changes

- Updated dependencies [90bbcd5]
  - @squawk/types@0.16.0

## 0.7.7

### Patch Changes

- Updated dependencies [83773dc]
  - @squawk/types@0.15.0

## 0.7.6

### Patch Changes

- Updated dependencies [311c537]
  - @squawk/types@0.14.0

## 0.7.5

### Patch Changes

- Updated dependencies [4ec8650]
  - @squawk/types@0.13.0

## 0.7.4

### Patch Changes

- Updated dependencies [07d3473]
  - @squawk/types@0.12.0

## 0.7.3

### Patch Changes

- Updated dependencies [ace3c0e]
  - @squawk/types@0.11.0

## 0.7.2

### Patch Changes

- Updated dependencies [841d8dd]
  - @squawk/types@0.10.0

## 0.7.1

### Patch Changes

- b293c35: ### Changed

  - Refreshed bundled FAA NASR snapshot to the 2026-10-29 cycle (up from 2026-09-03). New counts: 19,146 airports (+33), 6,923 airspace features (+11), 1,515 airways (-1), 67,583 fixes (-27), 1,604 navaids (-9).

## 0.7.0

### Minor Changes

- 9935693: ### Added

  - A `/meta` export subpath exposing the snapshot's build metadata - cycle date, build
    timestamp, and record counts - as a plain constant. Importing the package itself
    decompresses and parses the whole snapshot, because the metadata and the records come out
    of the same parse, so anything that only wanted to report which cycle it was serving had
    to pay for the entire dataset to find out. `usBundled<X>Properties` from
    `@squawk/<pkg>/meta` reads no files and costs nothing, so it behaves the same in Node and
    in the browser. The values are identical to `usBundled<X>.properties`.

## 0.6.12

### Patch Changes

- Updated dependencies [9015223]
  - @squawk/types@0.9.0

## 0.6.11

### Patch Changes

- 723d74a: ### Changed

  - Refreshed bundled FAA NASR snapshot to the 2026-09-03 cycle (up from 2026-06-11). New counts: 19,113 airports (+37), 6,912 airspace features (+1), 1,516 airways (-3), 67,610 fixes (+68), 1,613 navaids (-16).

## 0.6.10

### Patch Changes

- 3caa444: ### Changed

  - Refreshed bundled FAA NASR snapshot to the 2026-06-11 cycle (up from 2026-05-14). New counts: 19,076 airports (+2), 6,911 airspace features (unchanged), 1,519 airways (unchanged), 67,542 fixes (+15), 1,629 navaids (+1).

## 0.6.9

### Patch Changes

- 0aa555c: ### Changed
  - Refreshed bundled FAA NASR snapshot to the 2026-05-14 cycle (up from 2026-04-16). New counts: 19,074 airports (-23), 6,911 airspace features (+3), 1,519 airways (unchanged), 67,527 fixes (-198), 1,628 navaids (-5).

> Versions 0.6.4 through 0.6.8 were skipped. Those patch numbers were tombstoned by npm during cleanup of the 2026-05-11 supply-chain incident (see [pinned Announcements discussion](https://github.com/neilcochran/squawk/discussions/251)) and cannot be republished. The next clean patch after 0.6.3 is 0.6.9.

## 0.6.3

### Patch Changes

- Updated dependencies [b000a41]
  - @squawk/types@0.8.0

## 0.6.2

### Patch Changes

- b9ff30c: ### Fixed
  - Fix the broken MIT license badge link in every package README. The relative path was one level too shallow, so on GitHub (and on npm renderers that resolve relative paths against the repo) the badge landed on a non-existent `packages/LICENSE.md` instead of the repo's `LICENSE.md`. The badge now resolves correctly.
  - Fix the broken `Documentation` link in `@squawk/flight-math`'s README. The typedoc URL slug used an underscore (`_squawk_flight_math.html`) instead of the dash form every sibling README uses (`_squawk_flight-math.html`), returning 404. Now points at the live docs page.

- Updated dependencies [b9ff30c]
  - @squawk/types@0.7.2

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

- ff22bd5: Bump `@squawk/types` peer dependency to `^0.4.0` for the procedures CIFP migration. No behavioral changes.

### Patch Changes

- Updated dependencies [ff22bd5]
  - @squawk/types@0.5.0

## 0.4.1

### Patch Changes

- a4ba760: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [a4ba760]
  - @squawk/types@0.3.1

## 0.4.0

### Minor Changes

- dc5eeae: - Change `state` to optional (`string | undefined`) on `Airport`, `Navaid`, and `Fix` in `@squawk/types`. Consumers that read `.state` must now handle `undefined` for non-US records.
  - Include selected Canadian, Mexican, Caribbean, and Pacific facilities published by the FAA in `@squawk/airport-data`, `@squawk/navaid-data`, and `@squawk/fix-data` (+147 airports, +59 navaids, +645 fixes). Foreign records have `country` populated and `state` undefined.
  - Export `lookupCode` from `@squawk/build-shared`, a classification-map lookup helper that logs a one-time warning on unknown NASR codes so future cycle additions do not silently drop records.

### Patch Changes

- Updated dependencies [dc5eeae]
  - @squawk/types@0.3.0

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

- 40f0b9d: Add squawk/fixes and squawk/fix-data
- c1e728c: Add squawk Navaid packages
- ffe41f2: Standardize naming of properties/funcs and abbreviations

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
