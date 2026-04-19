# @squawk/airspace

## 0.4.1

### Patch Changes

- 51a9ddc: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [51a9ddc]
  - @squawk/types@0.3.1
  - @squawk/geo@0.2.1

## 0.4.0

### Minor Changes

- 6fe3325: - Change `state` to optional (`string | undefined`) on `Airport`, `Navaid`, and `Fix` in `@squawk/types`. Consumers that read `.state` must now handle `undefined` for non-US records.
  - Include selected Canadian, Mexican, Caribbean, and Pacific facilities published by the FAA in `@squawk/airport-data`, `@squawk/navaid-data`, and `@squawk/fix-data` (+147 airports, +59 navaids, +645 fixes). Foreign records have `country` populated and `state` undefined.
  - Export `lookupCode` from `@squawk/build-shared`, a classification-map lookup helper that logs a one-time warning on unknown NASR codes so future cycle additions do not silently drop records.

### Patch Changes

- Updated dependencies [6fe3325]
  - @squawk/types@0.3.0

## 0.3.0

### Minor Changes

- 59289ef: **@squawk/airspace**
  - `AirspaceResolver` is now an object with `.query()` and `.byAirport()` methods instead of a bare callable. Migrate `resolver(query)` call sites to `resolver.query(query)`.
  - `byAirport(identifier, types?)` returns every airspace feature whose `identifier` matches (case-insensitive), with full polygon boundary coordinates preserved. Intended for fetching all sectors of a Class B/C/D/E2 airspace around a given airport.

  **@squawk/mcp**
  - `get_airspace_for_airport` tool: given an FAA or ICAO airport identifier, returns every associated airspace feature (Class B/C/D/E2 surface-area classes by default) with full polygon boundary coordinates, suitable for drawing the full wedding-cake of shells on a terminal diagram.

## 0.2.3

### Patch Changes

- 3c224c1: ### Added
  - `@squawk/geo` package for shared geospatial utilities, grouping exports into `greatCircle` (`distanceNm`, `bearing`, `bearingAndDistance`, `midpoint`, `destination`) and `polygon` (`pointInPolygon`, `boundingBox`, `pointInBoundingBox`) namespaces. `greatCircle.midpoint` and `greatCircle.destination` are new capabilities; the rest are consolidated from existing packages.

  ### Removed
  - `distance.greatCircleDistanceNm` from `@squawk/units`. Moved to `@squawk/geo` as `greatCircle.distanceNm`.
  - `navigation.greatCircleBearing` and `navigation.greatCircleBearingAndDistance` from `@squawk/flight-math`. Moved to `@squawk/geo` as `greatCircle.bearing` and `greatCircle.bearingAndDistance`.

  ### Changed
  - `@squawk/airspace`, `@squawk/airports`, `@squawk/fixes`, `@squawk/navaids`, and `@squawk/flightplan` now import great-circle distance and polygon primitives from `@squawk/geo` instead of from `@squawk/units`/`@squawk/flight-math` or private internal helpers. Public APIs are unchanged.

- Updated dependencies [3c224c1]
  - @squawk/geo@0.2.0

## 0.2.2

### Patch Changes

- d52b90b: Update internal npm dependencies
- Updated dependencies [d52b90b]
  - @squawk/types@0.2.2

## 0.2.1

### Patch Changes

- 16d7bf1: Correct READMEs and TSDoc
- Updated dependencies [16d7bf1]
  - @squawk/types@0.2.1

## 0.2.0

### Minor Changes

- fc890a7: Add @squawk/airspace
- c7edad0: Add @squawk/airport-data package

### Patch Changes

- ab4fda1: Add associated data packages as devDependencies to airspace & airport - used for testing
- Updated dependencies [fc890a7]
- Updated dependencies [896ce8a]
- Updated dependencies [58a8dec]
- Updated dependencies [feaa9ab]
- Updated dependencies [a41e8da]
- Updated dependencies [b28de20]
- Updated dependencies [ec14992]
- Updated dependencies [005c963]
- Updated dependencies [893af47]
- Updated dependencies [5999218]
- Updated dependencies [f9cb361]
- Updated dependencies [303997a]
- Updated dependencies [53b25b2]
- Updated dependencies [2bdf6be]
- Updated dependencies [c7edad0]
- Updated dependencies [c4b7790]
- Updated dependencies [a76df6f]
- Updated dependencies [062f661]
  - @squawk/types@0.2.0
