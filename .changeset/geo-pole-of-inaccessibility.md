---
'@squawk/geo': minor
---

### Added

- `polygonGeoJson.poleOfInaccessibility()` finds the interior point of a GeoJSON polygon farthest from every edge, so a label anchor never lands outside a crescent, sector, or ring whose centroid does.
