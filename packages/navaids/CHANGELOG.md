# @squawk/navaids

## 0.2.3

### Patch Changes

- 3c224c1: ## Added
  - `@squawk/geo` package for shared geospatial utilities, grouping exports into `greatCircle` (`distanceNm`, `bearing`, `bearingAndDistance`, `midpoint`, `destination`) and `polygon` (`pointInPolygon`, `boundingBox`, `pointInBoundingBox`) namespaces. `greatCircle.midpoint` and `greatCircle.destination` are new capabilities; the rest are consolidated from existing packages.

  ## Removed
  - `distance.greatCircleDistanceNm` from `@squawk/units`. Moved to `@squawk/geo` as `greatCircle.distanceNm`.
  - `navigation.greatCircleBearing` and `navigation.greatCircleBearingAndDistance` from `@squawk/flight-math`. Moved to `@squawk/geo` as `greatCircle.bearing` and `greatCircle.bearingAndDistance`.

  ## Changed
  - `@squawk/airspace`, `@squawk/airports`, `@squawk/fixes`, `@squawk/navaids`, and `@squawk/flightplan` now import great-circle distance and polygon primitives from `@squawk/geo` instead of from `@squawk/units`/`@squawk/flight-math` or private internal helpers. Public APIs are unchanged.

- Updated dependencies [3c224c1]
  - @squawk/geo@0.2.0

## 0.2.2

### Patch Changes

- d52b90b: Update internal npm dependencies
- Updated dependencies [d52b90b]
  - @squawk/types@0.2.2
  - @squawk/units@0.2.2

## 0.2.1

### Patch Changes

- 16d7bf1: Correct READMEs and TSDoc
- Updated dependencies [16d7bf1]
  - @squawk/types@0.2.1
  - @squawk/units@0.2.1

## 0.2.0

### Minor Changes

- ec14992: Add squawk/fixes and squawk/fix-data
- 893af47: Add squawk Navaid packages

### Patch Changes

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
- Updated dependencies [95863cd]
- Updated dependencies [2bdf6be]
- Updated dependencies [c7edad0]
- Updated dependencies [c4b7790]
- Updated dependencies [a76df6f]
- Updated dependencies [062f661]
- Updated dependencies [51c15dd]
  - @squawk/types@0.2.0
  - @squawk/units@0.2.0
