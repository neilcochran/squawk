---
'@squawk/flightplan': minor
'@squawk/mcp': patch
---

### Added

- **@squawk/flightplan** `FlightplanFixLookup` and `FlightplanNavaidLookup` gain an
  optional `byIdentAtPosition(ident, lat, lon, toleranceNm?)` method. When a provider
  implements it, `createFlightplanResolver(...).parse()` resolves a fix or navaid token
  whose identifier is published in more than one region to the candidate nearest the most
  recently resolved positional element (a preceding airport, coordinate, waypoint, airway
  exit fix, or procedure terminus) rather than taking the first `byIdent` match. The first
  token in a route has no anchor, and providers exposing only `byIdent` are unaffected;
  both fall back to the first match.

### Changed

- **@squawk/mcp** the flightplan route tools (`parse_flightplan_route`,
  `compute_route_distance`, `get_route_geometry`, `get_route_timing`) now disambiguate
  shared-identifier route waypoints by proximity, because the bundled fix and navaid
  resolvers implement `byIdentAtPosition`. The tool surface is unchanged; a shared
  identifier that previously resolved to whichever record sorted first now resolves to the
  one nearest the surrounding route.
