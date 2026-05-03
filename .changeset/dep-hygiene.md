---
'@squawk/airways': patch
'@squawk/geo': patch
'@squawk/airspace': patch
---

### Removed

**@squawk/airways**

- Removed the unused `@squawk/units` runtime dependency.

### Changed

**@squawk/geo**

- `@types/geojson` is now declared as a direct dependency. The public GeoJSON-shaped helpers in `polygonGeoJson` take and return `Polygon` types, so an explicit declaration keeps consumer type-resolution stable rather than relying on the transitive through `@squawk/types`.

**@squawk/airspace**

- `@types/geojson` is now declared as a direct dependency. The resolver's public `FeatureCollection` input now has an explicit type-resolution path rather than relying on the transitive through `@squawk/types`.
