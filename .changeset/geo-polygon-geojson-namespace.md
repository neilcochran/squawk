---
'@squawk/geo': minor
---

### Added

- New `polygonGeoJson` namespace exposing helpers that operate directly on `geojson.Polygon`, alongside the existing `polygon.*` raw-coordinates API. Useful for app-level rendering and selection code that already speaks GeoJSON and would otherwise have to unpack rings into bare `number[][]` first. The `polygon.*` namespace is unchanged and remains the right level for indexing-heavy paths like `@squawk/airspace`'s point-in-airspace pipeline.
  - `polygonGeoJson.pointInPolygon(point, polygon)` - multi-ring aware: ring 0 is treated as the outer boundary, subsequent rings as holes (a point inside a hole is outside the polygon). Strictly more capable than `polygon.pointInPolygon`, which only takes a single ring.
  - `polygonGeoJson.polygonCentroid(polygon)` - arithmetic mean of outer-ring vertices, returns `undefined` when the ring is missing or has no usable coordinates.
  - `polygonGeoJson.polygonBoundingBox(polygon)` - bbox across every ring (outer plus holes; holes do not shrink the box). Empty polygons return a degenerate `Infinity` box, matching the `polygon.boundingBox` convention.
  - `polygonGeoJson.polygonsIdentical(a, b)` - coordinate-by-coordinate equality. Catches same-lateral-airspace-at-different-altitudes scenarios where two polygons share boundary geometry exactly.
  - `polygonGeoJson.polygonsSubstantiallyOverlap(a, b, aCentroid?)` - bidirectional centroid heuristic: identical polygons always count, otherwise `a`'s centroid in `b` OR `b`'s centroid in `a`. The optional pre-computed `aCentroid` lets callers skip a redundant centroid pass.
  - `polygonGeoJson.boundingBoxesOverlap(a, b)` - 2D AABB intersection over the existing `BoundingBox` interface; touching edges count as overlapping.
  - `polygonGeoJson.pointInBoundingBox(point, bbox)` - tuple-shape sibling to `polygon.pointInBoundingBox(lon, lat, bbox)`; useful when the caller already has `[lon, lat]` in tuple form.
