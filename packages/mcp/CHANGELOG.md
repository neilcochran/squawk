# @squawk/mcp

## 0.8.0

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

### Patch Changes

- Updated dependencies [7152f08]
  - @squawk/types@0.7.0
  - @squawk/airspace-data@0.4.0
  - @squawk/airspace@0.6.0
  - @squawk/airport-data@0.6.1
  - @squawk/airports@0.5.1
  - @squawk/airway-data@0.4.2
  - @squawk/airways@0.3.2
  - @squawk/fix-data@0.5.2
  - @squawk/fixes@0.2.2
  - @squawk/flightplan@0.4.2
  - @squawk/geo@0.3.2
  - @squawk/icao-registry@0.3.2
  - @squawk/icao-registry-data@0.4.2
  - @squawk/navaid-data@0.5.2
  - @squawk/navaids@0.3.2
  - @squawk/notams@0.3.2
  - @squawk/procedure-data@0.5.2
  - @squawk/procedures@0.4.2
  - @squawk/weather@0.5.1

## 0.7.0

### Minor Changes

- b4c9ec8: ### Added
  - `parseWindsAloft` parser in `@squawk/weather` for FD (Forecast Winds and Temperatures Aloft) bulletins - sometimes referred to by its older name "FB". Handles the AWC wire-format preamble (`(Extracted from ...)` and plain WMO header variants), fixed-width altitude columns, light-and-variable winds (raw code `9900`), high-speed wind encoding (direction codes 51-86 for speeds >= 100 kt), implicit-negative temperatures above the `TEMPS NEG ABV` threshold, and blank columns for altitudes outside a station's forecast range. Returns a structured `WindsAloftForecast` with per-station rows; each `WindsAloftLevel` carries `isMissing` and `isLightAndVariable` flags so variable winds aren't confused with zero speed.
  - `getLevelAtFt(station, altitudeFt)` helper in `@squawk/weather` that returns the `WindsAloftLevel` matching a given altitude column, or `undefined` when no column matches. No interpolation is performed.
  - `fetchWindsAloft` live-fetch helper in `@squawk/weather/fetch` wrapping the AWC `/api/data/windtemp` endpoint. Library-facing options use full-word names (`region`, `altitudeBand`, `forecastHours`) that map internally to the AWC wire params; region values include `contiguousUs`, `northeast`, `southeast`, `northCentral`, `southCentral`, `rockyMountain`, `pacificCoast`, `alaska`, `hawaii`, and `westernPacific`. All three parameters are optional - AWC applies its own defaults when omitted. Pairs with `@squawk/flight-math`'s wind-triangle solver for enroute time and fuel planning against real forecast winds.
  - New `WindsAloftForecast`, `WindsAloftStationForecast`, and `WindsAloftLevel` type exports from `@squawk/weather`.
  - `parse_winds_aloft` and `fetch_winds_aloft` tools in `@squawk/mcp`, exposing the parser and live-fetch helper over MCP.

### Patch Changes

- Updated dependencies [b4c9ec8]
  - @squawk/weather@0.5.0

## 0.6.0

### Minor Changes

- d72e966: ### Added
  - Required `timezone: string` field on the `Airport` type in `@squawk/types`, carrying an IANA zone identifier (e.g. `America/New_York`) resolved from the airport's lat/lon. Pass directly to `Intl.DateTimeFormat`, `Temporal`, `date-fns-tz`, `luxon`, etc. to format timestamps in the airport's local time with no runtime timezone dependency. Consumers constructing `Airport` objects by hand must now populate the field.
  - IANA `timezone` resolved for every record in `@squawk/airport-data` (19,097 US, territorial, and selected foreign facilities the FAA publishes). Resolved at build time from timezone-boundary-builder polygons.
  - "Local time at an airport" section in the `@squawk/airports` README showing `Intl.DateTimeFormat` usage.

  ### Changed
  - `get_airport_by_faa_id`, `get_airport_by_icao`, `find_nearest_airports`, and `search_airports` tools in `@squawk/mcp` now include the new `timezone` field on every returned airport record.

### Patch Changes

- Updated dependencies [d72e966]
  - @squawk/types@0.6.0
  - @squawk/airport-data@0.6.0
  - @squawk/airports@0.5.0
  - @squawk/airspace@0.5.1
  - @squawk/airway-data@0.4.1
  - @squawk/airways@0.3.1
  - @squawk/fix-data@0.5.1
  - @squawk/fixes@0.2.1
  - @squawk/flightplan@0.4.1
  - @squawk/geo@0.3.1
  - @squawk/icao-registry@0.3.1
  - @squawk/icao-registry-data@0.4.1
  - @squawk/navaid-data@0.5.1
  - @squawk/navaids@0.3.1
  - @squawk/notams@0.3.1
  - @squawk/procedure-data@0.5.1
  - @squawk/procedures@0.4.1
  - @squawk/weather@0.4.1

## 0.5.0

### Minor Changes

- 772b90d: Rewrite and expand the procedure tool surface to cover the new CIFP-sourced procedure resolver.

  ### Breaking changes:
  - Remove `get_procedure_by_code`. Replaced by `find_procedures_by_identifier` (returns all matches across airports) and `get_procedure_by_airport_and_identifier` (resolves a specific adaptation).
  - `expand_procedure` now requires `airportId` in addition to `identifier`; the result's `expansion` object exposes `legs` instead of `waypoints`.
  - `get_dataset_status` procedures entry now reports `cifpCycleDate`, `iapCount`, and `legCount` (previously `nasrCycleDate` and `waypointCount`).

  ### Added:
  - `find_procedures_by_identifier` returns every procedure publishing a CIFP identifier across airports.
  - `get_procedure_by_airport_and_identifier` resolves a single procedure at a specific airport.
  - `find_procedures_by_airport_and_runway` finds IAPs serving a runway plus SIDs/STARs with a matching runway transition.
  - `find_approaches_by_type` returns every IAP of a given approach classification (ILS, RNAV, VOR, NDB, etc.).
  - `search_procedures` accepts an `approachType` filter and accepts `'IAP'` as a `procedureType` value.
  - `expand_procedure` supports IAPs (approach transitions merge before the final approach segment).

### Patch Changes

- Updated dependencies [772b90d]
- Updated dependencies [772b90d]
- Updated dependencies [772b90d]
- Updated dependencies [772b90d]
- Updated dependencies [772b90d]
  - @squawk/procedure-data@0.5.0
  - @squawk/flightplan@0.4.0
  - @squawk/procedures@0.4.0
  - @squawk/airport-data@0.5.0
  - @squawk/airports@0.4.0
  - @squawk/airspace@0.5.0
  - @squawk/airway-data@0.4.0
  - @squawk/airways@0.3.0
  - @squawk/fix-data@0.5.0
  - @squawk/fixes@0.2.0
  - @squawk/geo@0.3.0
  - @squawk/icao-registry@0.3.0
  - @squawk/icao-registry-data@0.4.0
  - @squawk/navaid-data@0.5.0
  - @squawk/navaids@0.3.0
  - @squawk/notams@0.3.0
  - @squawk/weather@0.4.0
  - @squawk/types@0.5.0

## 0.4.1

### Patch Changes

- 51a9ddc: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [51a9ddc]
  - @squawk/icao-registry-data@0.3.3
  - @squawk/procedure-data@0.3.3
  - @squawk/icao-registry@0.2.3
  - @squawk/airport-data@0.4.1
  - @squawk/airway-data@0.3.3
  - @squawk/flight-math@0.5.1
  - @squawk/navaid-data@0.4.1
  - @squawk/flightplan@0.3.3
  - @squawk/procedures@0.2.4
  - @squawk/airports@0.3.2
  - @squawk/airspace@0.4.1
  - @squawk/fix-data@0.4.1
  - @squawk/airways@0.2.3
  - @squawk/navaids@0.2.4
  - @squawk/weather@0.3.4
  - @squawk/notams@0.2.3
  - @squawk/fixes@0.1.4
  - @squawk/types@0.3.1
  - @squawk/geo@0.2.1

## 0.4.0

### Minor Changes

- 6fe3325: - Change `state` to optional (`string | undefined`) on `Airport`, `Navaid`, and `Fix` in `@squawk/types`. Consumers that read `.state` must now handle `undefined` for non-US records.
  - Include selected Canadian, Mexican, Caribbean, and Pacific facilities published by the FAA in `@squawk/airport-data`, `@squawk/navaid-data`, and `@squawk/fix-data` (+147 airports, +59 navaids, +645 fixes). Foreign records have `country` populated and `state` undefined.
  - Export `lookupCode` from `@squawk/build-shared`, a classification-map lookup helper that logs a one-time warning on unknown NASR codes so future cycle additions do not silently drop records.

### Patch Changes

- fd8f93a: - Resolve dotted `PROCCODE.TRANSITION` tokens (e.g. `NUBLE4.JJIMY`) in flight plan routes; previously the parser marked them as unresolved and `compute_route_distance` skipped the procedure entirely.
  - Order SID transition expansions in departure order (common route then transition) so `procedures.expand()` and downstream route-distance calculations no longer backtrack through the procedure or duplicate the connecting fix.
  - Split multi-station TAF responses correctly when AWC separates records with a single newline; previously the second station's forecast groups were attributed to the first station, leaving its own `forecast` array empty.
- Updated dependencies [fd8f93a]
- Updated dependencies [6fe3325]
  - @squawk/flightplan@0.3.2
  - @squawk/procedures@0.2.3
  - @squawk/weather@0.3.3
  - @squawk/airport-data@0.4.0
  - @squawk/navaid-data@0.4.0
  - @squawk/airspace@0.4.0
  - @squawk/fix-data@0.4.0
  - @squawk/types@0.3.0

## 0.3.0

### Minor Changes

- 59289ef: **@squawk/airspace**
  - `AirspaceResolver` is now an object with `.query()` and `.byAirport()` methods instead of a bare callable. Migrate `resolver(query)` call sites to `resolver.query(query)`.
  - `byAirport(identifier, types?)` returns every airspace feature whose `identifier` matches (case-insensitive), with full polygon boundary coordinates preserved. Intended for fetching all sectors of a Class B/C/D/E2 airspace around a given airport.

  **@squawk/mcp**
  - `get_airspace_for_airport` tool: given an FAA or ICAO airport identifier, returns every associated airspace feature (Class B/C/D/E2 surface-area classes by default) with full polygon boundary coordinates, suitable for drawing the full wedding-cake of shells on a terminal diagram.

### Patch Changes

- Updated dependencies [59289ef]
  - @squawk/airspace@0.3.0

## 0.2.1

### Patch Changes

- 27594d8: **@squawk/notams**
  - Fix ReDoS in `parseNotam` Q-line extraction. A NOTAM containing many slashes after the Q-line could cause exponential regex backtracking (a 129-byte input previously hung the event loop for ~4s; now linear in input length).

  **@squawk/weather**
  - Fix polynomial-time slowdown in international SIGMET header stripping (used by `parseSigmet` and `parseSigmetBulletin`). Bulletins with many leading 4-letter tokens and no trailing dash on the SIGMET line previously took O(N²) time; now linear.
  - When a SIGMET prefix contains multiple FIR codes that survive WMO/AWIPS header stripping, all of them are now preserved in the body for downstream FIR parsing instead of only the FIR closest to `SIGMET`.

- Updated dependencies [27594d8]
  - @squawk/weather@0.3.2
  - @squawk/notams@0.2.2

## 0.2.0

### Minor Changes

- acd8576: - Add `@squawk/mcp` package: a Model Context Protocol stdio server that exposes squawk libraries as tools for LLM clients like Claude Desktop and Cursor.
  - Add `squawk-mcp` CLI binary, runnable via `npx @squawk/mcp`.
  - Add `createSquawkMcpServer()` factory for embedding the server in a custom MCP host.
  - Add 5 great-circle geometry tools wrapping `@squawk/geo`: `great_circle_distance`, `great_circle_bearing`, `great_circle_bearing_and_distance`, `great_circle_midpoint`, `great_circle_destination`.
  - Add 4 airport lookup tools wrapping `@squawk/airports`: `get_airport_by_faa_id`, `get_airport_by_icao`, `find_nearest_airports`, `search_airports`.
  - Add 1 airspace query tool wrapping `@squawk/airspace`: `query_airspace_at_position`.
  - Add 4 navaid tools wrapping `@squawk/navaids`: `get_navaid_by_ident`, `find_navaids_by_frequency`, `find_nearest_navaids`, `search_navaids`.
  - Add 3 fix tools wrapping `@squawk/fixes`: `get_fix_by_ident`, `find_nearest_fixes`, `search_fixes`.
  - Add 4 airway tools wrapping `@squawk/airways`: `get_airway_by_designation`, `expand_airway_segment`, `find_airways_by_fix`, `search_airways`.
  - Add 4 procedure tools wrapping `@squawk/procedures`: `get_procedure_by_code`, `find_procedures_by_airport`, `expand_procedure`, `search_procedures`.
  - Add 1 lazily-loaded ICAO registry tool wrapping `@squawk/icao-registry`: `lookup_aircraft_by_icao_hex`.
  - Add 5 weather parser tools wrapping `@squawk/weather`: `parse_metar`, `parse_taf`, `parse_sigmet`, `parse_airmet`, `parse_pirep`.
  - Add 5 live AWC fetch tools wrapping `@squawk/weather/fetch`: `fetch_metar`, `fetch_taf`, `fetch_pirep`, `fetch_sigmets`, `fetch_international_sigmets`.
  - Add 2 NOTAM parser tools wrapping `@squawk/notams`: `parse_icao_notam`, `parse_faa_notam`.
  - Add 2 flight plan tools wrapping `@squawk/flightplan`: `parse_flightplan_route`, `compute_route_distance`.
  - Add 22 flight-computer tools wrapping `@squawk/flight-math` covering atmosphere, airspeed, wind triangle, descent/climb planning, holding entry, turn dynamics, glide, NOAA solar times, WMM2025 magnetic declination, and fuel/PNR/ETP planning.
  - Add `get_dataset_status` tool reporting the FAA NASR cycle date, build timestamp, and record counts for each loaded snapshot (including the lazy ICAO registry's load state).
  - Add `SQUAWK_AWC_BASE_URL` environment variable to override the Aviation Weather Center base URL used by every `fetch_*` tool.
  - Add startup diagnostic that logs the Node version, platform, package version, and tool-module count to stderr, with a warning when global `fetch` is unavailable.
