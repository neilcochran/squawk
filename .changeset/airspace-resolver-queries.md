---
'@squawk/airspace': minor
---

### Added

- Four new query shapes on `AirspaceResolver`: `byCentroid({ lon, lat, toleranceDeg? })` resolves features whose polygon centroid is within tolerance of the query point (the URL-handle fallback for empty-identifier features); `byIdentifier(identifier, options?)` is a type-agnostic identifier lookup that spans both ARTCC and non-ARTCC partitions in one call; `withinBbox(bbox)` returns features whose pre-indexed bounding box overlaps a query bbox using the bounding box cached at resolver init; and `forEachIndexed(callback)` exposes a read-only iteration over the indexed corpus with positional `(feature, ring, boundingBox)` arguments. The existing `query`, `byAirport`, and `byArtcc` methods stay as ergonomic shortcuts; the new methods are additive. Two supporting types (`AirspaceCentroidQuery`, `AirspaceByIdentifierOptions`) are also exported from the package root.
