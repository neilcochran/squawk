---
'@squawk/flightplan': minor
'@squawk/mcp': minor
---

### Added

- `@squawk/flightplan` exposes the parsed route's drawable geometry:
  - `routeToLineString(route)` builds a GeoJSON `LineString` (GeoJSON `[lon, lat]` ordering) ready to render as a map polyline, or `undefined` when the route yields fewer than two drawable points.
  - `extractRoutePoints(route)` returns the ordered `RoutePoint[]` of drawable points, expanding airway and SID/STAR segments into their constituent fixes and suppressing consecutive duplicates. Coordinate-less elements (DCT, speed/altitude, unresolved) contribute no points.
  - `RouteLeg` (from `computeRouteDistance`) now carries `fromLat`/`fromLon`/`toLat`/`toLon` for each leg's endpoints, alongside the existing `from`/`to` labels.
- `@squawk/mcp` adds a `get_route_geometry` tool returning the ordered drawable points and GeoJSON `LineString` for a route string, and its `compute_route_distance` tool now reports the per-leg endpoint coordinates.
