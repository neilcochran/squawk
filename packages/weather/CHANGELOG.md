# @squawk/weather

## 0.4.1

### Patch Changes

- Updated dependencies [d72e966]
  - @squawk/types@0.6.0

## 0.4.0

### Minor Changes

- 772b90d: Bump `@squawk/types` peer dependency to `^0.4.0` for the procedures CIFP migration. No behavioral changes.

### Patch Changes

- Updated dependencies [772b90d]
  - @squawk/types@0.5.0

## 0.3.4

### Patch Changes

- 51a9ddc: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [51a9ddc]
  - @squawk/types@0.3.1

## 0.3.3

### Patch Changes

- fd8f93a: - Resolve dotted `PROCCODE.TRANSITION` tokens (e.g. `NUBLE4.JJIMY`) in flight plan routes; previously the parser marked them as unresolved and `compute_route_distance` skipped the procedure entirely.
  - Order SID transition expansions in departure order (common route then transition) so `procedures.expand()` and downstream route-distance calculations no longer backtrack through the procedure or duplicate the connecting fix.
  - Split multi-station TAF responses correctly when AWC separates records with a single newline; previously the second station's forecast groups were attributed to the first station, leaving its own `forecast` array empty.
- Updated dependencies [6fe3325]
  - @squawk/types@0.3.0

## 0.3.2

### Patch Changes

- 27594d8: **@squawk/notams**
  - Fix ReDoS in `parseNotam` Q-line extraction. A NOTAM containing many slashes after the Q-line could cause exponential regex backtracking (a 129-byte input previously hung the event loop for ~4s; now linear in input length).

  **@squawk/weather**
  - Fix polynomial-time slowdown in international SIGMET header stripping (used by `parseSigmet` and `parseSigmetBulletin`). Bulletins with many leading 4-letter tokens and no trailing dash on the SIGMET line previously took O(N²) time; now linear.
  - When a SIGMET prefix contains multiple FIR codes that survive WMO/AWIPS header stripping, all of them are now preserved in the body for downstream FIR parsing instead of only the FIR closest to `SIGMET`.

## 0.3.1

### Patch Changes

- f38a6ed: - Fix `parseInternationalSigmet` throwing on ICAO-format bulletins with fused letter+digit sequence identifiers (e.g. `SIGMET A9`, `SIGMET B02`, `SIGMET D10`, `SIGMET AB9`). Common in South American and oceanic FIR feeds.
  - Accept optional whitespace before the issuing-station dash in international SIGMET headers (`SBAZ -` as well as `SBAZ-`). The format detector, header stripper, and all header patterns now tolerate both forms.
  - Accept multiple FIR codes preceding `SIGMET` in international headers (e.g. `KZMA TJZS SIGMET FOXTROT 3`). The FIR code closest to `SIGMET` is captured as the primary; earlier FIR codes are consumed by the body-level FIR parser.
  - `parseInternationalCancellation` now handles cancellations that reference fused-identifier SIGMETs (e.g. `CNL SIGMET A6 ...`).

## 0.3.0

### Minor Changes

- f53c058: - Add opt-in fetch layer at `@squawk/weather/fetch` subpath; core parsing exports remain network-free
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

- d52b90b: Update internal npm dependencies
- Updated dependencies [d52b90b]
  - @squawk/types@0.2.2

## 0.2.2

### Patch Changes

- dc77760: Remove implementation status from squawk/weather README

## 0.2.1

### Patch Changes

- 16d7bf1: Correct READMEs and TSDoc
- Updated dependencies [16d7bf1]
  - @squawk/types@0.2.1

## 0.2.0

### Minor Changes

- feaa9ab: Add squawk/weather with METAR and SPECI support
- 005c963: Add TAF types and parsing to squawk/weather
- f9cb361: Add AIRMET support to squawk/weather
- 303997a: Add SIGMET parsing and shared types for DayTime and Coordinates
- 5860a4e: Increase parsing abilities of SIGMETs
- c4b7790: Add PIREP support to squawk/weather
- a76df6f: Standardize naming of properties/funcs and abbreviations
- 062f661: Move package specific types from squawk/types to their respective packages

### Patch Changes

- Updated dependencies [fc890a7]
- Updated dependencies [896ce8a]
- Updated dependencies [58a8dec]
- Updated dependencies [feaa9ab]
- Updated dependencies [a41e8da]
- Updated dependencies [b28de20]
- Updated dependencies [ec14992]
- Updated dependencies [005c963]
- Updated dependencies [893af47]
- Updated dependencies [5999218]
- Updated dependencies [f9cb361]
- Updated dependencies [303997a]
- Updated dependencies [53b25b2]
- Updated dependencies [2bdf6be]
- Updated dependencies [c7edad0]
- Updated dependencies [c4b7790]
- Updated dependencies [a76df6f]
- Updated dependencies [062f661]
  - @squawk/types@0.2.0
