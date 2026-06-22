---
'@squawk/flightplan': minor
'@squawk/mcp': minor
---

### Added

- `@squawk/flightplan` adds `computeRouteTiming(route, options)` for per-leg, wind-corrected timing:
  - Solves the wind triangle on each leg from its true course, a given true airspeed, and a wind to produce true heading, wind correction angle, ground speed, and estimated time enroute.
  - Winds are supplied through an optional `WindProvider` callback (`(lat, lon) => WindVector | undefined`) evaluated at each leg's midpoint, so the package stays agnostic of altitude and weather source. Legs with no wind are timed as calm (ground speed equals true airspeed).
  - Adds per-leg and total fuel burn when `fuelBurnPerHr` is given, plus endurance and fuel sufficiency when `fuelAvailable` is also given.
  - Exposes `WindProvider`, `RouteTimingOptions`, `RouteTimingLeg`, and `RouteTimingResult`, and re-exports `WindVector`.
- `@squawk/mcp` adds a `get_route_timing` tool that times a route under a single uniform wind, with optional fuel-burn and endurance reporting.
