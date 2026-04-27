# @squawk/flight-math

## 0.5.1

### Patch Changes

- 51a9ddc: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.

## 0.5.0

### Minor Changes

- 3c224c1: ### Added
  - `@squawk/geo` package for shared geospatial utilities, grouping exports into `greatCircle` (`distanceNm`, `bearing`, `bearingAndDistance`, `midpoint`, `destination`) and `polygon` (`pointInPolygon`, `boundingBox`, `pointInBoundingBox`) namespaces. `greatCircle.midpoint` and `greatCircle.destination` are new capabilities; the rest are consolidated from existing packages.

  ### Removed
  - `distance.greatCircleDistanceNm` from `@squawk/units`. Moved to `@squawk/geo` as `greatCircle.distanceNm`.
  - `navigation.greatCircleBearing` and `navigation.greatCircleBearingAndDistance` from `@squawk/flight-math`. Moved to `@squawk/geo` as `greatCircle.bearing` and `greatCircle.bearingAndDistance`.

  ### Changed
  - `@squawk/airspace`, `@squawk/airports`, `@squawk/fixes`, `@squawk/navaids`, and `@squawk/flightplan` now import great-circle distance and polygon primitives from `@squawk/geo` instead of from `@squawk/units`/`@squawk/flight-math` or private internal helpers. Public APIs are unchanged.

### Patch Changes

- Updated dependencies [3c224c1]
  - @squawk/units@0.3.0

## 0.4.0

### Minor Changes

- 32cab51: - Add `planning` namespace to `@squawk/flight-math` with classic E6B flight planning calculations: `fuelRequired()`, `endurance()`, `enduranceDistanceNm()`, `pointOfNoReturn()`, and `equalTimePoint()`
  - Add `PlanningPoint` type representing a computed point along a route (distance and time from departure)

## 0.3.1

### Patch Changes

- d52b90b: Update internal npm dependencies
- Updated dependencies [d52b90b]
  - @squawk/units@0.2.2

## 0.3.0

### Minor Changes

- 58c2e55: ### Added:
  - magnetic namespace with World Magnetic Model 2025 (WMM2025) magnetic declination and field computations
    - trueToMagnetic() and magneticToTrue() bearing conversion helpers
    - dateToDecimalYear() utility for converting Date objects to decimal years
    - MagneticFieldOptions and MagneticFieldResult types
    - WMM_EPOCH, WMM_VALID_START, WMM_VALID_END model validity constants

## 0.2.1

### Patch Changes

- 16d7bf1: Correct READMEs and TSDoc
- Updated dependencies [16d7bf1]
  - @squawk/units@0.2.1

## 0.2.0

### Minor Changes

- 18f3b1b: Add squawk/flight-math package
- 5999218: Move flight-math specific types from shared types to flight-math
- a76df6f: Standardize naming of properties/funcs and abbreviations

### Patch Changes

- Updated dependencies [b28de20]
- Updated dependencies [ec14992]
- Updated dependencies [893af47]
- Updated dependencies [95863cd]
- Updated dependencies [a76df6f]
- Updated dependencies [51c15dd]
  - @squawk/units@0.2.0
