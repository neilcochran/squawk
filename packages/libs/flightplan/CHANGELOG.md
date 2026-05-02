# @squawk/flightplan

## 0.4.4

### Patch Changes

- Updated dependencies [2ac2985]
  - @squawk/geo@0.4.0

## 0.4.3

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

- Updated dependencies [b47b118]
  - @squawk/geo@0.3.3
  - @squawk/types@0.7.1

## 0.4.2

### Patch Changes

- Updated dependencies [32f4925]
  - @squawk/types@0.7.0
  - @squawk/geo@0.3.2

## 0.4.1

### Patch Changes

- Updated dependencies [15fa9cf]
  - @squawk/types@0.6.0
  - @squawk/geo@0.3.1

## 0.4.0

### Minor Changes

- ff22bd5: Adapt route parsing to the new `@squawk/procedures` API and add airport-context resolution for shared procedure identifiers.

  ### Breaking changes:
  - `SidRouteElement.waypoints` and `StarRouteElement.waypoints` renamed to `.legs` with the new `ProcedureLeg` type.
  - `FlightplanProcedureLookup` interface updated to match the new procedures resolver: `byName(code)` replaced by `byIdentifier(identifier)` (returns an array); `expand` now takes `(airportId, identifier, transitionName?)` and returns `{ procedure, legs }`.

  ### Added:
  - Route parsing now resolves a procedure token (e.g. `NUBLE4`) against the most-recently-seen airport in the route, so the correct adaptation is picked when the same identifier is published at multiple airports.

  ### Changed:
  - Route-distance rendering of SID/STAR legs skips legs without a termination fix (heading, altitude, and manual-termination legs).

### Patch Changes

- Updated dependencies [ff22bd5]
- Updated dependencies [ff22bd5]
  - @squawk/geo@0.3.0
  - @squawk/types@0.5.0

## 0.3.3

### Patch Changes

- a4ba760: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [a4ba760]
  - @squawk/types@0.3.1
  - @squawk/geo@0.2.1

## 0.3.2

### Patch Changes

- 3b242d5: - Resolve dotted `PROCCODE.TRANSITION` tokens (e.g. `NUBLE4.JJIMY`) in flight plan routes; previously the parser marked them as unresolved and `compute_route_distance` skipped the procedure entirely.
  - Order SID transition expansions in departure order (common route then transition) so `procedures.expand()` and downstream route-distance calculations no longer backtrack through the procedure or duplicate the connecting fix.
  - Split multi-station TAF responses correctly when AWC separates records with a single newline; previously the second station's forecast groups were attributed to the first station, leaving its own `forecast` array empty.
- Updated dependencies [dc5eeae]
  - @squawk/types@0.3.0

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

- dede11e: ### Added
  - Add `computeRouteDistance()` for computing total great-circle route distance and estimated time enroute from a parsed route
  - Add `RouteLeg` interface representing a single leg between two geographic points, including distance and cumulative distance in nautical miles
  - Add `RouteDistanceResult` interface containing leg-by-leg breakdown, total distance, optional ETE, and any unresolved route elements

## 0.2.2

### Patch Changes

- 9b4c21b: Update internal npm dependencies
- Updated dependencies [9b4c21b]
  - @squawk/types@0.2.2

## 0.2.1

### Patch Changes

- fe66cec: Correct READMEs and TSDoc
- Updated dependencies [fe66cec]
  - @squawk/types@0.2.1

## 0.2.0

### Minor Changes

- 8edfb9b: Add squawk/flightplan package and fix a bug in squawk/airways
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
