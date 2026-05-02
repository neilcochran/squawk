# @squawk/fixes

## 0.2.4

### Patch Changes

- Updated dependencies [2ac2985]
  - @squawk/geo@0.4.0

## 0.2.3

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

- Updated dependencies [b47b118]
  - @squawk/geo@0.3.3
  - @squawk/types@0.7.1

## 0.2.2

### Patch Changes

- Updated dependencies [32f4925]
  - @squawk/types@0.7.0
  - @squawk/geo@0.3.2

## 0.2.1

### Patch Changes

- Updated dependencies [15fa9cf]
  - @squawk/types@0.6.0
  - @squawk/geo@0.3.1

## 0.2.0

### Minor Changes

- ff22bd5: Bump `@squawk/types` peer dependency to `^0.4.0` for the procedures CIFP migration. No behavioral changes.

### Patch Changes

- Updated dependencies [ff22bd5]
- Updated dependencies [ff22bd5]
  - @squawk/geo@0.3.0
  - @squawk/types@0.5.0

## 0.1.4

### Patch Changes

- a4ba760: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [a4ba760]
  - @squawk/types@0.3.1
  - @squawk/geo@0.2.1

## 0.1.3

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

## 0.1.2

### Patch Changes

- 9b4c21b: Update internal npm dependencies
- Updated dependencies [9b4c21b]
  - @squawk/types@0.2.2
  - @squawk/units@0.2.2

## 0.1.1

### Patch Changes

- fe66cec: Correct READMEs and TSDoc
- Updated dependencies [fe66cec]
  - @squawk/types@0.2.1
  - @squawk/units@0.2.1
