# @squawk/types

## 0.7.0

### Minor Changes

- 7152f08: ### Added

  **@squawk/types**
  - New `'ARTCC'` value on the `AirspaceType` union for Air Route Traffic Control Center boundary features.
  - New `ArtccStratum` union (`'LOW' | 'HIGH' | 'UTA' | 'CTA' | 'FIR' | 'CTA/FIR'`) describing the boundary stratum carried on each ARTCC feature.
  - New required `artccStratum: ArtccStratum | null` field on `AirspaceFeature`. Populated for `type === 'ARTCC'`; `null` for all other airspace types. Consumers constructing `AirspaceFeature` objects by hand must now populate the field.

  **@squawk/airspace-data**
  - Bundled GeoJSON snapshot now includes ARTCC lateral boundaries for every FAA-controlled center, sourced from NASR `ARB_BASE.csv` and `ARB_SEG.csv`. Covers LOW/HIGH strata for the 20 CONUS centers and Anchorage (ZAN), the UTA stratum for Oakland (ZOA), and oceanic CTA/FIR strata for ZAK, ZAP, ZHN, ZHU, ZMA, ZSU, and ZWY. Polygons are simplified with Douglas-Peucker at 0.001 deg tolerance and the bundled file grows by roughly 10 KB gzipped.
  - Antimeridian-crossing oceanic boundaries (ZAK and ZAP Pacific FIRs) are split at lon=±180 during the build, so every emitted feature stays within the standard `[-180, 180]` longitude range. A single source stratum can yield multiple features that share the same `(identifier, artccStratum)` pair - mirroring how multi-shape oceanic strata (e.g. ZOA UTA) already work.

  **@squawk/airspace**
  - New `byArtcc(identifier, stratum?)` method on `AirspaceResolver` that returns every ARTCC feature for a three-letter center code (`'ZNY'`, `'ZBW'`, etc.), with an optional stratum filter.
  - `query()` now returns ARTCC features alongside Class B/C/D/E and SUA hits when the queried position falls within a center's stratum. Floor and ceiling on ARTCC features use operational stratum approximations (LOW: SFC to FL180, HIGH: FL180 to FL600, UTA: FL600+, oceanic strata: SFC to unlimited) so altitude-aware queries pick the right stratum.

  **@squawk/mcp**
  - New `find_artcc_for_position` tool returning the ARTCC features (and stratum) containing a given position and altitude. Defaults `altitudeFt` to 0, which selects the LOW stratum and any oceanic CTA/FIR overlays.
  - New `find_artcc_by_identifier` tool returning every ARTCC feature for a center code, with full polygon boundaries and an optional stratum filter.
  - `query_airspace_at_position` now includes ARTCC features in its results, and `'ARTCC'` is a valid value in the `airspaceTypes` filter.

  ### Changed

  **@squawk/airspace**
  - `byAirport(identifier, types?)` now excludes ARTCC features by default, even when an ARTCC code happens to collide with an airport identifier. Use `byArtcc` for center lookups.

## 0.6.0

### Minor Changes

- d72e966: ### Added
  - Required `timezone: string` field on the `Airport` type in `@squawk/types`, carrying an IANA zone identifier (e.g. `America/New_York`) resolved from the airport's lat/lon. Pass directly to `Intl.DateTimeFormat`, `Temporal`, `date-fns-tz`, `luxon`, etc. to format timestamps in the airport's local time with no runtime timezone dependency. Consumers constructing `Airport` objects by hand must now populate the field.
  - IANA `timezone` resolved for every record in `@squawk/airport-data` (19,097 US, territorial, and selected foreign facilities the FAA publishes). Resolved at build time from timezone-boundary-builder polygons.
  - "Local time at an airport" section in the `@squawk/airports` README showing `Intl.DateTimeFormat` usage.

  ### Changed
  - `get_airport_by_faa_id`, `get_airport_by_icao`, `find_nearest_airports`, and `search_airports` tools in `@squawk/mcp` now include the new `timezone` field on every returned airport record.

## 0.5.0

### Minor Changes

- 772b90d: Expand the procedure type system for full ARINC 424 coverage of SIDs, STARs, and IAPs.

  ### Breaking changes:
  - Remove `ProcedureWaypoint`, `ProcedureWaypointTypeCode`, `ProcedureWaypointCategory`, `PROCEDURE_TYPE_MAP`, and `PROCEDURE_WAYPOINT_CATEGORY_MAP`. Use `ProcedureLeg` and `ProcedureLegFixCategory` instead.
  - Rename `Procedure.computerCode` to `Procedure.identifier`. The field now carries CIFP identifiers for IAPs (e.g. `"I04L"`) as well as SID/STAR identifiers (e.g. `"AALLE4"`).
  - Rename `ProcedureTransition.waypoints` and `ProcedureCommonRoute.waypoints` to `.legs`.
  - `ProcedureType` now includes `'IAP'`; `switch` statements on procedure type must handle the new variant.

  ### Added:
  - `ProcedureLeg` with the full ARINC 424 leg model: path terminator, altitude constraint, speed constraint, course, distance, RNP, turn direction, recommended navaid, fly-over / FAF / MAP / IAF / FACF flags.
  - `ProcedureLegPathTerminator` union of 23 ARINC 424 codes (`IF`, `TF`, `CF`, `DF`, `CA`, `CI`, `CR`, `FA`, `FC`, `FD`, `FM`, `HA`, `HF`, `HM`, `PI`, `RF`, `AF`, `VA`, `VI`, `VM`, `VR`, `VD`, `CD`).
  - `ApproachType` for IAP classification (`ILS`, `LOC`, `LOC_BC`, `RNAV`, `RNAV_RNP`, `VOR`, `VOR_DME`, `NDB`, `NDB_DME`, `TACAN`, `GLS`, `IGS`, `LDA`, `SDF`, `GPS`, `FMS`, `MLS`).
  - `AltitudeConstraint`, `AltitudeConstraintDescriptor`, `SpeedConstraint`, `SpeedConstraintDescriptor`, `MissedApproachSequence`, `TurnDirection`, `ProcedureLegFixCategory`.
  - Optional `Procedure.approachType`, `Procedure.runway`, `Procedure.missedApproach` populated for IAPs.
  - Optional `ProcedureCommonRoute.runway` for runway-tagged routes.

## 0.3.1

### Patch Changes

- 51a9ddc: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.

## 0.3.0

### Minor Changes

- 6fe3325: - Change `state` to optional (`string | undefined`) on `Airport`, `Navaid`, and `Fix` in `@squawk/types`. Consumers that read `.state` must now handle `undefined` for non-US records.
  - Include selected Canadian, Mexican, Caribbean, and Pacific facilities published by the FAA in `@squawk/airport-data`, `@squawk/navaid-data`, and `@squawk/fix-data` (+147 airports, +59 navaids, +645 fixes). Foreign records have `country` populated and `state` undefined.
  - Export `lookupCode` from `@squawk/build-shared`, a classification-map lookup helper that logs a one-time warning on unknown NASR codes so future cycle additions do not silently drop records.

## 0.2.2

### Patch Changes

- d52b90b: Update internal npm dependencies

## 0.2.1

### Patch Changes

- 16d7bf1: Correct READMEs and TSDoc

## 0.2.0

### Minor Changes

- fc890a7: Add @squawk/airspace
- 896ce8a: Add squawk/flightplan package and fix a bug in squawk/airways
- 58a8dec: Add ILS info to runways and add Coast Gaurd airports
- feaa9ab: Add squawk/weather with METAR and SPECI support
- a41e8da: Add NOTAM parsing for legacy FAA format to squawk/notam
- b28de20: Add airspace data build pipeline and @squawk/airspace-data package
- ec14992: Add squawk/fixes and squawk/fix-data
- 005c963: Add TAF types and parsing to squawk/weather
- 893af47: Add squawk Navaid packages
- 5999218: Move flight-math specific types from shared types to flight-math
- f9cb361: Add AIRMET support to squawk/weather
- 303997a: Add SIGMET parsing and shared types for DayTime and Coordinates
- 53b25b2: Add Class-E support and data to squawk/airspace-data
- 2bdf6be: Add @squawk/icon-registry and @squawk/icao-registry-data
- c7edad0: Add @squawk/airport-data package
- c4b7790: Add PIREP support to squawk/weather
- a76df6f: Standardize naming of properties/funcs and abbreviations
- 062f661: Move package specific types from squawk/types to their respective packages

## 0.1.1

### Patch Changes

- a8026d4: Add initial test coverage for AircraftCategory
