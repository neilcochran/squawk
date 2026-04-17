---
'@squawk/weather': minor
---

- Add opt-in fetch layer at `@squawk/weather/fetch` subpath; core parsing exports remain network-free
- Add `fetchMetar(ids, options?)` for METARs via `/api/data/metar?format=raw`, accepting a single ICAO or comma-joined array
- Add `fetchTaf(ids, options?)` for TAFs via `/api/data/taf?format=raw`, accepting a single ICAO or comma-joined array
- Add `fetchPirep(id, options?)` for PIREPs via `/api/data/pirep?format=raw`, with optional `distance`, `age`, `level`, and `inten` filters; requires a 4-letter ICAO
- Add `fetchSigmets(options?)` for domestic CONUS SIGMETs via `/api/data/airsigmet?format=raw`, with an optional `hazard` filter
- Add `fetchInternationalSigmets(options?)` for ICAO-format SIGMETs via `/api/data/isigmet?format=raw`
- Add `AwcFetchError` thrown on non-2xx responses; per-record parse failures are surfaced via `parseErrors` without losing successful records
- Add `FetchWeatherOptions` supporting `signal` (AbortSignal) and `baseUrl` override, shared by all fetch functions
- Add handling for AWC wire-format wrappers (`Type: X Hazard: Y` preambles and `----------------------` record separators) inside the fetch layer, keeping the pure SIGMET parser coded strictly to the WMO spec
