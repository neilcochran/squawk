---
'@squawk/procedures': minor
---

Rewrite resolver for unified SID/STAR/IAP coverage.

### Breaking changes:

- Remove `byName(computerCode)`. CIFP identifiers are not globally unique (the same identifier is often published at multiple airports), so single-result lookup was replaced by `byIdentifier()` (returns array) and `byAirportAndIdentifier()` (returns a single specific match).
- `expand()` signature changed from `expand(computerCode, transitionName?)` to `expand(airportId, identifier, transitionName?)`. An airport must now disambiguate which adaptation of a shared identifier to expand.
- `ProcedureExpansionResult.waypoints` renamed to `.legs` with the richer `ProcedureLeg` type.

### Added:

- `byIdentifier(identifier)` returns every `Procedure` publishing that identifier across airports.
- `byAirportAndIdentifier(airportId, identifier)` resolves a single procedure at a specific airport.
- `byAirportAndRunway(airportId, runway)` returns IAPs serving a runway plus SIDs/STARs with a matching runway transition.
- `byApproachType(approachType)` returns every IAP of a given approach classification (ILS, RNAV, VOR, etc.).
- `ProcedureSearchQuery.approachType` filters search results by IAP approach type.
- `expand()` supports IAPs (approach transitions merge before the final approach segment) and merges legs in flying order based on procedure type and whether the transition is a runway transition (`RW*`) or enroute/approach transition.

### Changed:

- `byType` now accepts `'SID'`, `'STAR'`, or `'IAP'`.
- Search results are sorted by airport then identifier.
