# @squawk/mcp

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
