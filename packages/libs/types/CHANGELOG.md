# @squawk/types

## 0.16.1

### Patch Changes

- 334a4ee: ### Changed

  - `AirwayWaypoint` documents that its segment fields follow the airway's published order, and how to read them in a reversed slice. `Navaid.publicUse` is documented as present on every bundled record and `simultaneousVoice` as absent where the source does not say.

## 0.16.0

### Minor Changes

- 90bbcd5: ### Changed

  - Breaking: `FixNavaidAssociation.bearingDeg` is renamed `magneticBearingDeg`, and it and `distanceNm` are optional. The bearing is magnetic for every facility type, which the old name did not say. The FAA publishes many associations with only one of the two values (a localizer course or a radial without DME, a DME fix) and some with neither, and a required pair forced the data to leave them out.
  - Breaking for an exhaustive `switch`: `AircraftType` gains `other`, the FAA's category for aircraft that fit none of the rest.
  - `Navaid.frequencyMhz` documents that a TACAN on a channel with no VOR-band pairing publishes 133.3 to 135.95 MHz. `magneticVariationDeg` documents that it is the variation the station is aligned to, which is what its radials are measured against, and that a DME, VOT or fan marker has none. `markerIdentifier`, `markerShape` and `markerBearingDeg` say what the FAA publishes in them.

  ### Added
  - `AircraftRegistration.registrationStatus` with the `RegistrationStatus` union, covering every status the FAA registry publishes (valid, pending, sale reported, assigned but never registered, expired, revoked, canceled), and `registrationExpirationDate` as an ISO date. A registry record is not necessarily a current registration, and the status says which it is.
  - `Navaid.remarks`, the FAA's remarks on a navaid, most of them the radials, distances and altitudes where its signal is unusable.
  - `Navaid.dmeStatus`, the status of the distance-measuring component where the FAA publishes it separately from the navaid's own.
  - `Navaid.checkpoints` with `NavaidCheckpoint`, `NavaidCheckpointType` and `NAVAID_CHECKPOINT_TYPE_MAP`: the published VOR receiver checkpoints.

## 0.15.0

### Minor Changes

- 83773dc: ### Changed

  - Breaking: `Airport.trafficPatternAltitudeFt` is renamed `trafficPatternAltitudeFtAgl`. The FAA publishes the traffic pattern altitude in feet above the field, and the old name read as MSL; 246 of the 540 published values lie below their field elevation.
  - Breaking: `Airport.elevationFt` and the `identifier`, `localizerFrequencyMhz` and `localizerMagneticCourseDeg` of `IlsSystem` are required. Every bundled record carries them, and an ILS without a frequency or course is not an ILS. `artccId`, `county` and `towerType` stay optional, documented as present on every bundled record, because the type also serves consumers who bring their own data and a non-NASR airport has no ARTCC or county.
  - Breaking: `Runway.pcn`, which no snapshot ever populated, is replaced by `pavementClassification`, a structured `PavementClassification` with the rating system (`PCN` or `PCR`), the value, the pavement type, the subgrade strength and tire pressure categories and the evaluation method, so an aircraft's ACN or ACR can be compared against the pavement.
  - Breaking: `BORDER` is removed from `AirwayWaypointType`. NASR publishes border crossings without coordinates and the bundled airway data never carried one.

  ### Added
  - `AirportFrequency` gains `receiveOnly` and `onRequest` (the FAA's `R` and `X` qualifiers), `provider` and `providerType` (the facility providing the service and how the FAA codes it), `callSign`, `approachCallSign` and `remark`. `frequencyMhz` documents that the HF frequencies the FAA publishes in kHz are converted to MHz.
  - `RunwayEnd.rvrLocations` lists where runway visual range is measured (`TOUCHDOWN`, `MIDPOINT`, `ROLLOUT`); `hasRvr` is true whenever it is non-empty.
  - `RvrLocation`, `PavementClassification`, `PavementClassificationSystem`, `PavementType`, `SubgradeStrengthCategory`, `TirePressureCategory` and `PavementEvaluationMethod`.
  - TSDoc notes that `trueHeadingDeg` publishes north as both 0 and 360, that `magneticVariationYear` is carried as published (2030 and 1904 appear), and that a runway length or width is absent where the FAA publishes its 0 placeholder.

## 0.14.0

### Minor Changes

- 311c537: ### Added

  - `SPECIAL` joins `AirwayType` for the FAA's non-regulatory `ZK` special routes: low-level RNAV routes used mainly by helicopter air ambulance operators, not on public charts and filed only with FAA Flight Standards approval. `ATS_TYPE_MAP` maps the `SP` prefix to it.
  - `AirwayDirection`, `AIRWAY_DIRECTIONS` and `isAirwayDirection` model the eight `BND` directions of travel an airway altitude can apply to.
  - `AirwayWaypoint` gains `unusable` (the segment starting at the waypoint may not be flown), `remarks`, `magneticVariationDeg` and `magneticVariationDirection` at navaid waypoints, `rnpNm`, and the four DME/DME/IRU MEA fields; `Airway` gains `remarks`.
  - `AirwaySegmentReference` names a segment of an airway expansion by index and endpoint identifiers, so gaps and unusable segments share one shape; `AirwayGap` is now an alias of it.

  ### Changed
  - Every airway altitude direction field is typed `AirwayDirection` instead of `string` and is present only with its altitude.
  - The minimum crossing altitude fields are documented at the waypoint the FAA names for them, `BORDER` is documented as a reserved waypoint type the bundled data never carries, and `state` and `icaoRegionCode` document NASR's pseudo-codes and the single-letter offshore region codes.

## 0.13.0

### Minor Changes

- 4ec8650: ### Added

  - `AltitudeBound.inclusive`, `false` when a bound excludes its own value; `AirspaceVolume`, a polygon between a floor and a ceiling; and `AirspaceFeature.exclusions`, the volumes carved out of a feature.

  ### Changed
  - `AirspaceFeature` docs describe the identifier semantics per type, `controllingFacility` as the controlling ARTCC of Special Use Airspace and null elsewhere, the one published ceiling above the 99,999 sentinel, the multi-feature airspaces, and the exclusive Class E ceiling beneath Class A.

## 0.12.0

### Minor Changes

- 07d3473: ### Added

  - `ProcedureLeg.verticalAngleDeg`, `turnDirectionValid`, `gnssFmsIndication`, `routeTypeQualifier1` and `routeTypeQualifier2`, and `Procedure.transitionAltitudeFt`, for the CIFP leg fields the procedure data now carries. The three codes are typed as `GnssFmsIndication`, `ApproachRouteQualifier1` and `ApproachRouteQualifier2`, with every ARINC 424 value documented. `TurnDirection` accepts `E` (either direction).

  ### Changed
  - `SpeedConstraintDescriptor`, `ProcedureCommonRoute.runway`, `Procedure.name` and `Procedure.runway` docs describe the mandatory meaning of `@`, the `B` both-parallels runway convention, indicator-letter and `COPTER` names, and course-named approaches.

## 0.11.0

### Minor Changes

- ace3c0e: ### Added

  - `AirwayGap`, describing a published discontinuity between two consecutive waypoints of an airway expansion: the index of the waypoint before the gap and the identifiers on either side.

## 0.10.1

### Patch Changes

- aa1e979: **@squawk/airspace-data**

  ### Changed
  - Class E areas beneath Class A carry a ceiling of 17,999 ft MSL instead of the 99,999 undefined-ceiling sentinel. NASR leaves the upper limit of nearly every Class E area undefined because 14 CFR 71.71 ends those areas at the overlying controlled airspace, so an altitude query at or above 18,000 ft returned Class E alongside Class A. The build now resolves that for every Class E area whose polygon overlaps a Class A feature. Class E outside Class A (Hawaii and the Pacific territories) keeps the sentinel, published Class E ceilings are kept, and Special Use Airspace with an undefined ceiling is untouched, since it genuinely extends through Class A.

  **@squawk/types**

  ### Changed
  - `AltitudeBound` and `AirspaceType` docs describe the 99,999 undefined-ceiling sentinel and the Class E ceiling beneath Class A.

  **@squawk/airspace**

  ### Changed
  - README documents the Class E ceiling beneath Class A and its effect on `query()`.

  **@squawk/mcp**

  ### Changed
  - `query_airspace_at_position` describes the Class E ceiling beneath Class A, so a vertical profile at 18,000 ft and above returns Class A rather than the Class E area under it.

## 0.10.0

### Minor Changes

- 841d8dd: **@squawk/types**

  ### Added
  - `CLASS_A` on `AirspaceType` and `AIRSPACE_TYPES`.

  **@squawk/airspace-data**

  ### Added
  - Class A airspace, which the FAA publishes as a rule rather than as geometry: one `CLASS_A` feature per domestic ARTCC HIGH stratum shape (and San Juan's combined stratum), carrying 18,000 ft MSL to FL600 over the stratum's polygon. Honolulu and the oceanic centers have no HIGH stratum and get none, as 14 CFR 71.33 designates no Class A there. Each feature is named `CLASS A` with an empty identifier; adjacent centers' polygons abut, so dedupe by type for a single answer.

  **@squawk/airspace**

  ### Changed
  - README documents Class A coverage and the dedupe note.

  **@squawk/mcp**

  ### Added
  - `query_airspace_at_position` and `search_airspace` accept `CLASS_A` as a type filter, and the position query describes Class A coverage.

## 0.9.0

### Minor Changes

- 9015223: ### Added

  - `Aircraft` gains five new optional fields for previously-undecodable ADS-B/Mode-S data: `emergencyState`, `resolutionAdvisory`, `targetState`, `identActive`, `squawkAlert`.
  - `EmergencyState`, `TargetStateAndStatus`, `AcasResolutionAdvisoryReport`, `ResolutionAdvisoryType`, and the `AcasThreat` union (`AcasThreatType`, `AcasThreatNone`, `AcasThreatIcaoAddress`, `AcasThreatAltitudeRangeBearing`) - promoted from `@squawk/mode-s`, which re-exports them for backward compatibility.

## 0.8.6

### Changed

- Administrative release to skip npm-tombstoned version numbers. No functional or API changes.

> Versions 0.8.1 through 0.8.5 were tombstoned by npm during cleanup of the 2026-05-11 supply-chain incident (see [pinned Announcements discussion](https://github.com/neilcochran/squawk/discussions/251)) and cannot be republished. The next clean patch after 0.8.0 is 0.8.6.

## 0.8.0

### Minor Changes

- b000a41: ### Added
  - `is<Name>` type guards and `<NAME>S` const arrays for the user-facing string-literal union types: `AirspaceType`, `ArtccStratum`, `FacilityType`, `AirwayType`, `NavaidType`, `FixUseCode`. Each guard narrows an external string into the union, and each const array is the single source of truth for value-side iteration. Useful when consuming URL params, config files, or MCP tool inputs that need validation before being used as a typed filter; centralizing the membership list here means each consumer no longer hand-rolls its own predicate that silently drifts when a new union member is added. The arrays are branded with `as const satisfies readonly <Type>[]` so dropping a member or adding one to the type without updating the array fails the build.

## 0.7.2

### Patch Changes

- b9ff30c: ### Fixed
  - Fix the broken MIT license badge link in every package README. The relative path was one level too shallow, so on GitHub (and on npm renderers that resolve relative paths against the repo) the badge landed on a non-existent `packages/LICENSE.md` instead of the repo's `LICENSE.md`. The badge now resolves correctly.
  - Fix the broken `Documentation` link in `@squawk/flight-math`'s README. The typedoc URL slug used an underscore (`_squawk_flight_math.html`) instead of the dash form every sibling README uses (`_squawk_flight-math.html`), returning 404. Now points at the live docs page.

## 0.7.1

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

## 0.7.0

### Minor Changes

- 32f4925: ### Added

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

- 15fa9cf: ### Added
  - Required `timezone: string` field on the `Airport` type in `@squawk/types`, carrying an IANA zone identifier (e.g. `America/New_York`) resolved from the airport's lat/lon. Pass directly to `Intl.DateTimeFormat`, `Temporal`, `date-fns-tz`, `luxon`, etc. to format timestamps in the airport's local time with no runtime timezone dependency. Consumers constructing `Airport` objects by hand must now populate the field.
  - IANA `timezone` resolved for every record in `@squawk/airport-data` (19,097 US, territorial, and selected foreign facilities the FAA publishes). Resolved at build time from timezone-boundary-builder polygons.
  - "Local time at an airport" section in the `@squawk/airports` README showing `Intl.DateTimeFormat` usage.

  ### Changed
  - `get_airport_by_faa_id`, `get_airport_by_icao`, `find_nearest_airports`, and `search_airports` tools in `@squawk/mcp` now include the new `timezone` field on every returned airport record.

## 0.5.0

### Minor Changes

- ff22bd5: Expand the procedure type system for full ARINC 424 coverage of SIDs, STARs, and IAPs.

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

- a4ba760: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.

## 0.3.0

### Minor Changes

- dc5eeae: - Change `state` to optional (`string | undefined`) on `Airport`, `Navaid`, and `Fix` in `@squawk/types`. Consumers that read `.state` must now handle `undefined` for non-US records.
  - Include selected Canadian, Mexican, Caribbean, and Pacific facilities published by the FAA in `@squawk/airport-data`, `@squawk/navaid-data`, and `@squawk/fix-data` (+147 airports, +59 navaids, +645 fixes). Foreign records have `country` populated and `state` undefined.
  - Export `lookupCode` from `@squawk/build-shared`, a classification-map lookup helper that logs a one-time warning on unknown NASR codes so future cycle additions do not silently drop records.

## 0.2.2

### Patch Changes

- 9b4c21b: Update internal npm dependencies

## 0.2.1

### Patch Changes

- fe66cec: Correct READMEs and TSDoc

## 0.2.0

### Minor Changes

- 7d0383e: Add @squawk/airspace
- 8edfb9b: Add squawk/flightplan package and fix a bug in squawk/airways
- df74bd6: Add ILS info to runways and add Coast Gaurd airports
- f92d3e2: Add squawk/weather with METAR and SPECI support
- 3f23773: Add NOTAM parsing for legacy FAA format to squawk/notam
- 1be39b2: Add airspace data build pipeline and @squawk/airspace-data package
- 40f0b9d: Add squawk/fixes and squawk/fix-data
- cac443c: Add TAF types and parsing to squawk/weather
- c1e728c: Add squawk Navaid packages
- 985f0a8: Move flight-math specific types from shared types to flight-math
- 4711295: Add AIRMET support to squawk/weather
- 6af10db: Add SIGMET parsing and shared types for DayTime and Coordinates
- d554f7c: Add Class-E support and data to squawk/airspace-data
- d7ac351: Add @squawk/icon-registry and @squawk/icao-registry-data
- a409b07: Add @squawk/airport-data package
- 746447f: Add PIREP support to squawk/weather
- ffe41f2: Standardize naming of properties/funcs and abbreviations
- 875fc8b: Move package specific types from squawk/types to their respective packages

## 0.1.1

### Patch Changes

- a8026d4: Add initial test coverage for AircraftCategory
