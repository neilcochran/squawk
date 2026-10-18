---
'@squawk/geo': minor
---

### Added

- `greatCircle.densify(lat1, lon1, lat2, lon2, maxSegmentNm)` returns evenly spaced points along the great-circle arc between two positions, no more than `maxSegmentNm` apart, with both endpoints included exactly as given. A long leg drawn on a flat map as a straight line between its endpoints visibly departs from the arc its distance describes; drawing it through these points follows the arc. Intermediate longitudes are normalized to [-180, 180], so a consumer drawing an antimeridian crossing unwraps them first. A `maxSegmentNm` that is not a positive finite number throws a `RangeError`.
