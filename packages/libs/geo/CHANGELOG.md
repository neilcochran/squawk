# @squawk/geo

## 0.4.0

### Minor Changes

- 2ac2985: ### Added
  - New `polygonGeoJson` namespace exposing helpers that operate directly on `geojson.Polygon`, alongside the existing `polygon.*` raw-coordinates API. Useful for app-level rendering and selection code that already speaks GeoJSON and would otherwise have to unpack rings into bare `number[][]` first. The `polygon.*` namespace is unchanged and remains the right level for indexing-heavy paths like `@squawk/airspace`'s point-in-airspace pipeline.
    - `polygonGeoJson.pointInPolygon(point, polygon)` - multi-ring aware: ring 0 is treated as the outer boundary, subsequent rings as holes (a point inside a hole is outside the polygon). Strictly more capable than `polygon.pointInPolygon`, which only takes a single ring.
    - `polygonGeoJson.polygonCentroid(polygon)` - arithmetic mean of outer-ring vertices, returns `undefined` when the ring is missing or has no usable coordinates.
    - `polygonGeoJson.polygonBoundingBox(polygon)` - bbox across every ring (outer plus holes; holes do not shrink the box). Empty polygons return a degenerate `Infinity` box, matching the `polygon.boundingBox` convention.
    - `polygonGeoJson.polygonsIdentical(a, b)` - coordinate-by-coordinate equality. Catches same-lateral-airspace-at-different-altitudes scenarios where two polygons share boundary geometry exactly.
    - `polygonGeoJson.polygonsSubstantiallyOverlap(a, b, aCentroid?)` - bidirectional centroid heuristic: identical polygons always count, otherwise `a`'s centroid in `b` OR `b`'s centroid in `a`. The optional pre-computed `aCentroid` lets callers skip a redundant centroid pass.
    - `polygonGeoJson.boundingBoxesOverlap(a, b)` - 2D AABB intersection over the existing `BoundingBox` interface; touching edges count as overlapping.
    - `polygonGeoJson.pointInBoundingBox(point, bbox)` - tuple-shape sibling to `polygon.pointInBoundingBox(lon, lat, bbox)`; useful when the caller already has `[lon, lat]` in tuple form.

## 0.3.3

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

- Updated dependencies [b47b118]
  - @squawk/types@0.7.1
  - @squawk/units@0.4.1

## 0.3.2

### Patch Changes

- Updated dependencies [32f4925]
  - @squawk/types@0.7.0

## 0.3.1

### Patch Changes

- Updated dependencies [15fa9cf]
  - @squawk/types@0.6.0

## 0.3.0

### Minor Changes

- ff22bd5: Bump `@squawk/types` peer dependency to `^0.4.0` for the procedures CIFP migration. No behavioral changes.

### Patch Changes

- Updated dependencies [ff22bd5]
  - @squawk/types@0.5.0

## 0.2.1

### Patch Changes

- a4ba760: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [a4ba760]
  - @squawk/types@0.3.1

## 0.2.0

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
