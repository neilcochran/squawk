# @squawk/flight-math

## 0.5.3

### Patch Changes

- b9ff30c: ### Fixed
  - Fix the broken MIT license badge link in every package README. The relative path was one level too shallow, so on GitHub (and on npm renderers that resolve relative paths against the repo) the badge landed on a non-existent `packages/LICENSE.md` instead of the repo's `LICENSE.md`. The badge now resolves correctly.
  - Fix the broken `Documentation` link in `@squawk/flight-math`'s README. The typedoc URL slug used an underscore (`_squawk_flight_math.html`) instead of the dash form every sibling README uses (`_squawk_flight-math.html`), returning 404. Now points at the live docs page.

- Updated dependencies [b9ff30c]
  - @squawk/units@0.4.2

## 0.5.2

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

- Updated dependencies [b47b118]
  - @squawk/units@0.4.1

## 0.5.1

### Patch Changes

- a4ba760: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.

## 0.5.0

### Minor Changes

- 58257db: ### Added
  - `@squawk/geo` package for shared geospatial utilities, grouping exports into `greatCircle` (`distanceNm`, `bearing`, `bearingAndDistance`, `midpoint`, `destination`) and `polygon` (`pointInPolygon`, `boundingBox`, `pointInBoundingBox`) namespaces. `greatCircle.midpoint` and `greatCircle.destination` are new capabilities; the rest are consolidated from existing packages.

  ### Removed
  - `distance.greatCircleDistanceNm` from `@squawk/units`. Moved to `@squawk/geo` as `greatCircle.distanceNm`.
  - `navigation.greatCircleBearing` and `navigation.greatCircleBearingAndDistance` from `@squawk/flight-math`. Moved to `@squawk/geo` as `greatCircle.bearing` and `greatCircle.bearingAndDistance`.

  ### Changed
  - `@squawk/airspace`, `@squawk/airports`, `@squawk/fixes`, `@squawk/navaids`, and `@squawk/flightplan` now import great-circle distance and polygon primitives from `@squawk/geo` instead of from `@squawk/units`/`@squawk/flight-math` or private internal helpers. Public APIs are unchanged.

### Patch Changes

- Updated dependencies [58257db]
  - @squawk/units@0.3.0

## 0.4.0

### Minor Changes

- 4bfe28e: - Add `planning` namespace to `@squawk/flight-math` with classic E6B flight planning calculations: `fuelRequired()`, `endurance()`, `enduranceDistanceNm()`, `pointOfNoReturn()`, and `equalTimePoint()`
  - Add `PlanningPoint` type representing a computed point along a route (distance and time from departure)

## 0.3.1

### Patch Changes

- 9b4c21b: Update internal npm dependencies
- Updated dependencies [9b4c21b]
  - @squawk/units@0.2.2

## 0.3.0

### Minor Changes

- 2ef2f69: ### Added:
  - magnetic namespace with World Magnetic Model 2025 (WMM2025) magnetic declination and field computations
    - trueToMagnetic() and magneticToTrue() bearing conversion helpers
    - dateToDecimalYear() utility for converting Date objects to decimal years
    - MagneticFieldOptions and MagneticFieldResult types
    - WMM_EPOCH, WMM_VALID_START, WMM_VALID_END model validity constants

## 0.2.1

### Patch Changes

- fe66cec: Correct READMEs and TSDoc
- Updated dependencies [fe66cec]
  - @squawk/units@0.2.1

## 0.2.0

### Minor Changes

- 0b8c6dd: Add squawk/flight-math package
- 985f0a8: Move flight-math specific types from shared types to flight-math
- ffe41f2: Standardize naming of properties/funcs and abbreviations

### Patch Changes

- Updated dependencies [1be39b2]
- Updated dependencies [40f0b9d]
- Updated dependencies [c1e728c]
- Updated dependencies [ba098bd]
- Updated dependencies [ffe41f2]
- Updated dependencies [51c15dd]
  - @squawk/units@0.2.0
