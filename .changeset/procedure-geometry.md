---
'@squawk/procedures': minor
'@squawk/mcp': minor
---

### Added

- `@squawk/procedures` exposes an expanded procedure's drawable geometry:
  - `expansionToLineString(legs)` builds a GeoJSON `LineString` (GeoJSON `[lon, lat]` ordering) ready to render as a map polyline, or `undefined` when the leg sequence yields fewer than two drawable points.
  - `extractLegPoints(legs)` returns the ordered `ProcedureLegPoint[]` of drawable fix points (each with `label`, `lat`, `lon`), skipping non-positional legs (course/heading-to-altitude, DME, radial, intercept, manual, and the HA/HM holds) and suppressing consecutive duplicate points.
- `@squawk/mcp` adds a `get_procedure_geometry` tool returning the ordered drawable fix points and GeoJSON `LineString` for an expanded procedure (optionally merging a named transition).
