---
'@squawk/flightplan': minor
---

Adapt route parsing to the new `@squawk/procedures` API and add airport-context resolution for shared procedure identifiers.

### Breaking changes:

- `SidRouteElement.waypoints` and `StarRouteElement.waypoints` renamed to `.legs` with the new `ProcedureLeg` type.
- `FlightplanProcedureLookup` interface updated to match the new procedures resolver: `byName(code)` replaced by `byIdentifier(identifier)` (returns an array); `expand` now takes `(airportId, identifier, transitionName?)` and returns `{ procedure, legs }`.

### Added:

- Route parsing now resolves a procedure token (e.g. `NUBLE4`) against the most-recently-seen airport in the route, so the correct adaptation is picked when the same identifier is published at multiple airports.

### Changed:

- Route-distance rendering of SID/STAR legs skips legs without a termination fix (heading, altitude, and manual-termination legs).
