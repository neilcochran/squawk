---
'@squawk/units': minor
---

- `fuel` namespace in `@squawk/units` with gal/L/lb/kg conversions
- `FuelDensity` discriminated union (`{ kgPerL }` or `{ lbPerGal }`) for density-aware volume <-> mass conversions
- `FUEL_DENSITY` constants for common aviation fuels: 100LL, Jet A, Jet A-1, Jet B (nominal at 15 C)
- `mb` (millibar) and `kPa` members of `PressureUnit`, with 14 new pairwise pressure conversions routing through hPa
- `formatFuel(value, unit, options?)` formatter with sensible per-unit precision defaults

- `formatQNH` now accepts `mb` and `kPa` units (0 and 2 decimal defaults respectively)
