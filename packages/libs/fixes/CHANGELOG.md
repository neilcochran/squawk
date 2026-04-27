# @squawk/fixes

## 0.2.4

### Patch Changes

- Updated dependencies [5a181dc]
  - @squawk/geo@0.4.0

## 0.2.3

### Patch Changes

- c7e6e12: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

- Updated dependencies [c7e6e12]
  - @squawk/geo@0.3.3
  - @squawk/types@0.7.1

## 0.2.2

### Patch Changes

- Updated dependencies [7152f08]
  - @squawk/types@0.7.0
  - @squawk/geo@0.3.2

## 0.2.1

### Patch Changes

- Updated dependencies [d72e966]
  - @squawk/types@0.6.0
  - @squawk/geo@0.3.1

## 0.2.0

### Minor Changes

- 772b90d: Bump `@squawk/types` peer dependency to `^0.4.0` for the procedures CIFP migration. No behavioral changes.

### Patch Changes

- Updated dependencies [772b90d]
- Updated dependencies [772b90d]
  - @squawk/geo@0.3.0
  - @squawk/types@0.5.0

## 0.1.4

### Patch Changes

- 51a9ddc: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [51a9ddc]
  - @squawk/types@0.3.1
  - @squawk/geo@0.2.1

## 0.1.3

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

## 0.1.2

### Patch Changes

- d52b90b: Update internal npm dependencies
- Updated dependencies [d52b90b]
  - @squawk/types@0.2.2
  - @squawk/units@0.2.2

## 0.1.1

### Patch Changes

- 16d7bf1: Correct READMEs and TSDoc
- Updated dependencies [16d7bf1]
  - @squawk/types@0.2.1
  - @squawk/units@0.2.1
