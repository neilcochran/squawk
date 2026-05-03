# @squawk/weather

## 0.5.4

### Patch Changes

- b9ff30c: ### Fixed
  - Fix the broken MIT license badge link in every package README. The relative path was one level too shallow, so on GitHub (and on npm renderers that resolve relative paths against the repo) the badge landed on a non-existent `packages/LICENSE.md` instead of the repo's `LICENSE.md`. The badge now resolves correctly.
  - Fix the broken `Documentation` link in `@squawk/flight-math`'s README. The typedoc URL slug used an underscore (`_squawk_flight_math.html`) instead of the dash form every sibling README uses (`_squawk_flight-math.html`), returning 404. Now points at the live docs page.

- Updated dependencies [b9ff30c]
  - @squawk/types@0.7.2

## 0.5.3

### Patch Changes

- e3d5ecb: ### Fixed
  - Hardened `parseAirmet` (and the `parse_airmet` MCP tool that wraps it) against a polynomial-time ReDoS in its section-splitter regex (CodeQL `js/polynomial-redos`, CWE-1333). The previous pattern had two ambiguous `\s*` quantifiers separated by a literal `.`, and `\s` matches `\n` - so on inputs with long newline runs the engine could backtrack every newline assignment at every starting position. A bulletin with ~80k leading newlines pinned the parser thread for ~23 seconds; the replacement uses `[^\S\n]*` (whitespace excluding newline) so the `\n` boundaries anchor unambiguously and completes the same input in under a millisecond. No behavior change for valid AIRMET bulletins.

## 0.5.2

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

- Updated dependencies [b47b118]
  - @squawk/types@0.7.1

## 0.5.1

### Patch Changes

- Updated dependencies [32f4925]
  - @squawk/types@0.7.0

## 0.5.0

### Minor Changes

- 93430b6: ### Added
  - `parseWindsAloft` parser in `@squawk/weather` for FD (Forecast Winds and Temperatures Aloft) bulletins - sometimes referred to by its older name "FB". Handles the AWC wire-format preamble (`(Extracted from ...)` and plain WMO header variants), fixed-width altitude columns, light-and-variable winds (raw code `9900`), high-speed wind encoding (direction codes 51-86 for speeds >= 100 kt), implicit-negative temperatures above the `TEMPS NEG ABV` threshold, and blank columns for altitudes outside a station's forecast range. Returns a structured `WindsAloftForecast` with per-station rows; each `WindsAloftLevel` carries `isMissing` and `isLightAndVariable` flags so variable winds aren't confused with zero speed.
  - `getLevelAtFt(station, altitudeFt)` helper in `@squawk/weather` that returns the `WindsAloftLevel` matching a given altitude column, or `undefined` when no column matches. No interpolation is performed.
  - `fetchWindsAloft` live-fetch helper in `@squawk/weather/fetch` wrapping the AWC `/api/data/windtemp` endpoint. Library-facing options use full-word names (`region`, `altitudeBand`, `forecastHours`) that map internally to the AWC wire params; region values include `contiguousUs`, `northeast`, `southeast`, `northCentral`, `southCentral`, `rockyMountain`, `pacificCoast`, `alaska`, `hawaii`, and `westernPacific`. All three parameters are optional - AWC applies its own defaults when omitted. Pairs with `@squawk/flight-math`'s wind-triangle solver for enroute time and fuel planning against real forecast winds.
  - New `WindsAloftForecast`, `WindsAloftStationForecast`, and `WindsAloftLevel` type exports from `@squawk/weather`.
  - `parse_winds_aloft` and `fetch_winds_aloft` tools in `@squawk/mcp`, exposing the parser and live-fetch helper over MCP.

## 0.4.1

### Patch Changes

- Updated dependencies [15fa9cf]
  - @squawk/types@0.6.0

## 0.4.0

### Minor Changes

- ff22bd5: Bump `@squawk/types` peer dependency to `^0.4.0` for the procedures CIFP migration. No behavioral changes.

### Patch Changes

- Updated dependencies [ff22bd5]
  - @squawk/types@0.5.0

## 0.3.4

### Patch Changes

- a4ba760: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [a4ba760]
  - @squawk/types@0.3.1

## 0.3.3

### Patch Changes

- 3b242d5: - Resolve dotted `PROCCODE.TRANSITION` tokens (e.g. `NUBLE4.JJIMY`) in flight plan routes; previously the parser marked them as unresolved and `compute_route_distance` skipped the procedure entirely.
  - Order SID transition expansions in departure order (common route then transition) so `procedures.expand()` and downstream route-distance calculations no longer backtrack through the procedure or duplicate the connecting fix.
  - Split multi-station TAF responses correctly when AWC separates records with a single newline; previously the second station's forecast groups were attributed to the first station, leaving its own `forecast` array empty.
- Updated dependencies [dc5eeae]
  - @squawk/types@0.3.0

## 0.3.2

### Patch Changes

- 7bac924: **@squawk/notams**
  - Fix ReDoS in `parseNotam` Q-line extraction. A NOTAM containing many slashes after the Q-line could cause exponential regex backtracking (a 129-byte input previously hung the event loop for ~4s; now linear in input length).

  **@squawk/weather**
  - Fix polynomial-time slowdown in international SIGMET header stripping (used by `parseSigmet` and `parseSigmetBulletin`). Bulletins with many leading 4-letter tokens and no trailing dash on the SIGMET line previously took O(N²) time; now linear.
  - When a SIGMET prefix contains multiple FIR codes that survive WMO/AWIPS header stripping, all of them are now preserved in the body for downstream FIR parsing instead of only the FIR closest to `SIGMET`.

## 0.3.1

### Patch Changes

- 7ec44e5: - Fix `parseInternationalSigmet` throwing on ICAO-format bulletins with fused letter+digit sequence identifiers (e.g. `SIGMET A9`, `SIGMET B02`, `SIGMET D10`, `SIGMET AB9`). Common in South American and oceanic FIR feeds.
  - Accept optional whitespace before the issuing-station dash in international SIGMET headers (`SBAZ -` as well as `SBAZ-`). The format detector, header stripper, and all header patterns now tolerate both forms.
  - Accept multiple FIR codes preceding `SIGMET` in international headers (e.g. `KZMA TJZS SIGMET FOXTROT 3`). The FIR code closest to `SIGMET` is captured as the primary; earlier FIR codes are consumed by the body-level FIR parser.
  - `parseInternationalCancellation` now handles cancellations that reference fused-identifier SIGMETs (e.g. `CNL SIGMET A6 ...`).

## 0.3.0

### Minor Changes

- 2bf5e03: - Add opt-in fetch layer at `@squawk/weather/fetch` subpath; core parsing exports remain network-free
  - Add `fetchMetar(ids, options?)` for METARs via `/api/data/metar?format=raw`, accepting a single ICAO or comma-joined array
  - Add `fetchTaf(ids, options?)` for TAFs via `/api/data/taf?format=raw`, accepting a single ICAO or comma-joined array
  - Add `fetchPirep(id, options?)` for PIREPs via `/api/data/pirep?format=raw`, with optional `distance`, `age`, `level`, and `inten` filters; requires a 4-letter ICAO
  - Add `fetchSigmets(options?)` for domestic CONUS SIGMETs via `/api/data/airsigmet?format=raw`, with an optional `hazard` filter
  - Add `fetchInternationalSigmets(options?)` for ICAO-format SIGMETs via `/api/data/isigmet?format=raw`
  - Add `AwcFetchError` thrown on non-2xx responses; per-record parse failures are surfaced via `parseErrors` without losing successful records
  - Add `FetchWeatherOptions` supporting `signal` (AbortSignal) and `baseUrl` override, shared by all fetch functions
  - Add handling for AWC wire-format wrappers (`Type: X Hazard: Y` preambles and `----------------------` record separators) inside the fetch layer, keeping the pure SIGMET parser coded strictly to the WMO spec

## 0.2.3

### Patch Changes

- 9b4c21b: Update internal npm dependencies
- Updated dependencies [9b4c21b]
  - @squawk/types@0.2.2

## 0.2.2

### Patch Changes

- 2edabb5: Remove implementation status from squawk/weather README

## 0.2.1

### Patch Changes

- fe66cec: Correct READMEs and TSDoc
- Updated dependencies [fe66cec]
  - @squawk/types@0.2.1

## 0.2.0

### Minor Changes

- f92d3e2: Add squawk/weather with METAR and SPECI support
- cac443c: Add TAF types and parsing to squawk/weather
- 4711295: Add AIRMET support to squawk/weather
- 6af10db: Add SIGMET parsing and shared types for DayTime and Coordinates
- 638b3ed: Increase parsing abilities of SIGMETs
- 746447f: Add PIREP support to squawk/weather
- ffe41f2: Standardize naming of properties/funcs and abbreviations
- 875fc8b: Move package specific types from squawk/types to their respective packages

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
