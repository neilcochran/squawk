---
'@squawk/weather': minor
'@squawk/mcp': minor
---

### Added

- `parseWindsAloft` parser in `@squawk/weather` for FD (Forecast Winds and Temperatures Aloft) bulletins - sometimes referred to by its older name "FB". Handles the AWC wire-format preamble (`(Extracted from ...)` and plain WMO header variants), fixed-width altitude columns, light-and-variable winds (raw code `9900`), high-speed wind encoding (direction codes 51-86 for speeds >= 100 kt), implicit-negative temperatures above the `TEMPS NEG ABV` threshold, and blank columns for altitudes outside a station's forecast range. Returns a structured `WindsAloftForecast` with per-station rows; each `WindsAloftLevel` carries `isMissing` and `isLightAndVariable` flags so variable winds aren't confused with zero speed.
- `getLevelAtFt(station, altitudeFt)` helper in `@squawk/weather` that returns the `WindsAloftLevel` matching a given altitude column, or `undefined` when no column matches. No interpolation is performed.
- `fetchWindsAloft` live-fetch helper in `@squawk/weather/fetch` wrapping the AWC `/api/data/windtemp` endpoint. Library-facing options use full-word names (`region`, `altitudeBand`, `forecastHours`) that map internally to the AWC wire params; region values include `contiguousUs`, `northeast`, `southeast`, `northCentral`, `southCentral`, `rockyMountain`, `pacificCoast`, `alaska`, `hawaii`, and `westernPacific`. All three parameters are optional - AWC applies its own defaults when omitted. Pairs with `@squawk/flight-math`'s wind-triangle solver for enroute time and fuel planning against real forecast winds.
- New `WindsAloftForecast`, `WindsAloftStationForecast`, and `WindsAloftLevel` type exports from `@squawk/weather`.
- `parse_winds_aloft` and `fetch_winds_aloft` tools in `@squawk/mcp`, exposing the parser and live-fetch helper over MCP.
