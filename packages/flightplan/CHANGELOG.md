# @squawk/flightplan

## 0.4.0

### Minor Changes

- 772b90d: Adapt route parsing to the new `@squawk/procedures` API and add airport-context resolution for shared procedure identifiers.

  ### Breaking changes:
  - `SidRouteElement.waypoints` and `StarRouteElement.waypoints` renamed to `.legs` with the new `ProcedureLeg` type.
  - `FlightplanProcedureLookup` interface updated to match the new procedures resolver: `byName(code)` replaced by `byIdentifier(identifier)` (returns an array); `expand` now takes `(airportId, identifier, transitionName?)` and returns `{ procedure, legs }`.

  ### Added:
  - Route parsing now resolves a procedure token (e.g. `NUBLE4`) against the most-recently-seen airport in the route, so the correct adaptation is picked when the same identifier is published at multiple airports.

  ### Changed:
  - Route-distance rendering of SID/STAR legs skips legs without a termination fix (heading, altitude, and manual-termination legs).

### Patch Changes

- Updated dependencies [772b90d]
- Updated dependencies [772b90d]
  - @squawk/geo@0.3.0
  - @squawk/types@0.5.0

## 0.3.3

### Patch Changes

- 51a9ddc: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [51a9ddc]
  - @squawk/types@0.3.1
  - @squawk/geo@0.2.1

## 0.3.2

### Patch Changes

- fd8f93a: - Resolve dotted `PROCCODE.TRANSITION` tokens (e.g. `NUBLE4.JJIMY`) in flight plan routes; previously the parser marked them as unresolved and `compute_route_distance` skipped the procedure entirely.
  - Order SID transition expansions in departure order (common route then transition) so `procedures.expand()` and downstream route-distance calculations no longer backtrack through the procedure or duplicate the connecting fix.
  - Split multi-station TAF responses correctly when AWC separates records with a single newline; previously the second station's forecast groups were attributed to the first station, leaving its own `forecast` array empty.
- Updated dependencies [6fe3325]
  - @squawk/types@0.3.0

## 0.3.1

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

## 0.3.0

### Minor Changes

- 1567376: ### Added
  - Add `computeRouteDistance()` for computing total great-circle route distance and estimated time enroute from a parsed route
  - Add `RouteLeg` interface representing a single leg between two geographic points, including distance and cumulative distance in nautical miles
  - Add `RouteDistanceResult` interface containing leg-by-leg breakdown, total distance, optional ETE, and any unresolved route elements

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

- 896ce8a: Add squawk/flightplan package and fix a bug in squawk/airways
- a76df6f: Standardize naming of properties/funcs and abbreviations

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
- Updated dependencies [2bdf6be]
- Updated dependencies [c7edad0]
- Updated dependencies [c4b7790]
- Updated dependencies [a76df6f]
- Updated dependencies [062f661]
  - @squawk/types@0.2.0
