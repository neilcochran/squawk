# @squawk/procedures

## 0.4.3

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

- Updated dependencies [b47b118]
  - @squawk/types@0.7.1

## 0.4.2

### Patch Changes

- Updated dependencies [32f4925]
  - @squawk/types@0.7.0

## 0.4.1

### Patch Changes

- Updated dependencies [15fa9cf]
  - @squawk/types@0.6.0

## 0.4.0

### Minor Changes

- ff22bd5: Rewrite resolver for unified SID/STAR/IAP coverage.

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

### Patch Changes

- Updated dependencies [ff22bd5]
  - @squawk/types@0.5.0

## 0.2.4

### Patch Changes

- a4ba760: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [a4ba760]
  - @squawk/types@0.3.1

## 0.2.3

### Patch Changes

- 3b242d5: - Resolve dotted `PROCCODE.TRANSITION` tokens (e.g. `NUBLE4.JJIMY`) in flight plan routes; previously the parser marked them as unresolved and `compute_route_distance` skipped the procedure entirely.
  - Order SID transition expansions in departure order (common route then transition) so `procedures.expand()` and downstream route-distance calculations no longer backtrack through the procedure or duplicate the connecting fix.
  - Split multi-station TAF responses correctly when AWC separates records with a single newline; previously the second station's forecast groups were attributed to the first station, leaving its own `forecast` array empty.
- Updated dependencies [dc5eeae]
  - @squawk/types@0.3.0

## 0.2.2

### Patch Changes

- 9b4c21b: Update internal npm dependencies
- Updated dependencies [9b4c21b]
  - @squawk/types@0.2.2

## 0.2.1

### Patch Changes

- fe66cec: Correct READMEs and TSDoc
- Updated dependencies [fe66cec]
  - @squawk/types@0.2.1

## 0.2.0

### Minor Changes

- ba098bd: Add squawk/procedures and squawk/procedure-data packages

### Patch Changes

- Updated dependencies [7d0383e]
- Updated dependencies [8edfb9b]
- Updated dependencies [df74bd6]
- Updated dependencies [f92d3e2]
- Updated dependencies [3f23773]
- Updated dependencies [1be39b2]
- Updated dependencies [40f0b9d]
- Updated dependencies [cac443c]
- Updated dependencies [c1e728c]
- Updated dependencies [985f0a8]
- Updated dependencies [4711295]
- Updated dependencies [6af10db]
- Updated dependencies [d554f7c]
- Updated dependencies [d7ac351]
- Updated dependencies [a409b07]
- Updated dependencies [746447f]
- Updated dependencies [ffe41f2]
- Updated dependencies [875fc8b]
  - @squawk/types@0.2.0
