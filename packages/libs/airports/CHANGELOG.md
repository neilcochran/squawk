# @squawk/airports

## 0.5.3

### Patch Changes

- Updated dependencies [2ac2985]
  - @squawk/geo@0.4.0

## 0.5.2

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

- Updated dependencies [b47b118]
  - @squawk/geo@0.3.3
  - @squawk/types@0.7.1

## 0.5.1

### Patch Changes

- Updated dependencies [32f4925]
  - @squawk/types@0.7.0
  - @squawk/geo@0.3.2

## 0.5.0

### Minor Changes

- 15fa9cf: ### Added
  - Required `timezone: string` field on the `Airport` type in `@squawk/types`, carrying an IANA zone identifier (e.g. `America/New_York`) resolved from the airport's lat/lon. Pass directly to `Intl.DateTimeFormat`, `Temporal`, `date-fns-tz`, `luxon`, etc. to format timestamps in the airport's local time with no runtime timezone dependency. Consumers constructing `Airport` objects by hand must now populate the field.
  - IANA `timezone` resolved for every record in `@squawk/airport-data` (19,097 US, territorial, and selected foreign facilities the FAA publishes). Resolved at build time from timezone-boundary-builder polygons.
  - "Local time at an airport" section in the `@squawk/airports` README showing `Intl.DateTimeFormat` usage.

  ### Changed
  - `get_airport_by_faa_id`, `get_airport_by_icao`, `find_nearest_airports`, and `search_airports` tools in `@squawk/mcp` now include the new `timezone` field on every returned airport record.

### Patch Changes

- Updated dependencies [15fa9cf]
  - @squawk/types@0.6.0
  - @squawk/geo@0.3.1

## 0.4.0

### Minor Changes

- ff22bd5: Bump `@squawk/types` peer dependency to `^0.4.0` for the procedures CIFP migration. No behavioral changes.

### Patch Changes

- Updated dependencies [ff22bd5]
- Updated dependencies [ff22bd5]
  - @squawk/geo@0.3.0
  - @squawk/types@0.5.0

## 0.3.2

### Patch Changes

- a4ba760: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [a4ba760]
  - @squawk/types@0.3.1
  - @squawk/geo@0.2.1

## 0.3.1

### Patch Changes

- 58257db: ### Added
  - `@squawk/geo` package for shared geospatial utilities, grouping exports into `greatCircle` (`distanceNm`, `bearing`, `bearingAndDistance`, `midpoint`, `destination`) and `polygon` (`pointInPolygon`, `boundingBox`, `pointInBoundingBox`) namespaces. `greatCircle.midpoint` and `greatCircle.destination` are new capabilities; the rest are consolidated from existing packages.

  ### Removed
  - `distance.greatCircleDistanceNm` from `@squawk/units`. Moved to `@squawk/geo` as `greatCircle.distanceNm`.
  - `navigation.greatCircleBearing` and `navigation.greatCircleBearingAndDistance` from `@squawk/flight-math`. Moved to `@squawk/geo` as `greatCircle.bearing` and `greatCircle.bearingAndDistance`.

  ### Changed
  - `@squawk/airspace`, `@squawk/airports`, `@squawk/fixes`, `@squawk/navaids`, and `@squawk/flightplan` now import great-circle distance and polygon primitives from `@squawk/geo` instead of from `@squawk/units`/`@squawk/flight-math` or private internal helpers. Public APIs are unchanged.

- Updated dependencies [58257db]
  - @squawk/geo@0.2.0

## 0.3.0

### Minor Changes

- 97ab18e: - Add `minRunwayLengthFt` option to `NearestAirportQuery` for filtering nearest-airport results by minimum runway length. Only airports with at least one runway meeting the specified length (in feet) are included.

## 0.2.2

### Patch Changes

- 9b4c21b: Update internal npm dependencies
- Updated dependencies [9b4c21b]
  - @squawk/types@0.2.2
  - @squawk/units@0.2.2

## 0.2.1

### Patch Changes

- fe66cec: Correct READMEs and TSDoc
- Updated dependencies [fe66cec]
  - @squawk/types@0.2.1
  - @squawk/units@0.2.1

## 0.2.0

### Minor Changes

- 40f0b9d: Add squawk/fixes and squawk/fix-data
- c1e728c: Add squawk Navaid packages
- b6e360c: Add @squawk/airports package

### Patch Changes

- 06904c8: Add associated data packages as devDependencies to airspace & airport - used for testing
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
- Updated dependencies [ba098bd]
- Updated dependencies [d7ac351]
- Updated dependencies [a409b07]
- Updated dependencies [746447f]
- Updated dependencies [ffe41f2]
- Updated dependencies [875fc8b]
- Updated dependencies [51c15dd]
  - @squawk/types@0.2.0
  - @squawk/units@0.2.0
