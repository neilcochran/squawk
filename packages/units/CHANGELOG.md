# @squawk/units

## 0.4.0

### Minor Changes

- f92dbf4: - `fuel` namespace in `@squawk/units` with gal/L/lb/kg conversions
  - `FuelDensity` discriminated union (`{ kgPerL }` or `{ lbPerGal }`) for density-aware volume <-> mass conversions
  - `FUEL_DENSITY` constants for common aviation fuels: 100LL, Jet A, Jet A-1, Jet B (nominal at 15 C)
  - `mb` (millibar) and `kPa` members of `PressureUnit`, with 14 new pairwise pressure conversions routing through hPa
  - `formatFuel(value, unit, options?)` formatter with sensible per-unit precision defaults
  - `formatQNH` now accepts `mb` and `kPa` units (0 and 2 decimal defaults respectively)

## 0.3.0

### Minor Changes

- 3c224c1: ### Added
  - `@squawk/geo` package for shared geospatial utilities, grouping exports into `greatCircle` (`distanceNm`, `bearing`, `bearingAndDistance`, `midpoint`, `destination`) and `polygon` (`pointInPolygon`, `boundingBox`, `pointInBoundingBox`) namespaces. `greatCircle.midpoint` and `greatCircle.destination` are new capabilities; the rest are consolidated from existing packages.

  ### Removed
  - `distance.greatCircleDistanceNm` from `@squawk/units`. Moved to `@squawk/geo` as `greatCircle.distanceNm`.
  - `navigation.greatCircleBearing` and `navigation.greatCircleBearingAndDistance` from `@squawk/flight-math`. Moved to `@squawk/geo` as `greatCircle.bearing` and `greatCircle.bearingAndDistance`.

  ### Changed
  - `@squawk/airspace`, `@squawk/airports`, `@squawk/fixes`, `@squawk/navaids`, and `@squawk/flightplan` now import great-circle distance and polygon primitives from `@squawk/geo` instead of from `@squawk/units`/`@squawk/flight-math` or private internal helpers. Public APIs are unchanged.

## 0.2.2

### Patch Changes

- d52b90b: Update internal npm dependencies

## 0.2.1

### Patch Changes

- 16d7bf1: Correct READMEs and TSDoc

## 0.2.0

### Minor Changes

- b28de20: Add airspace data build pipeline and @squawk/airspace-data package
- ec14992: Add squawk/fixes and squawk/fix-data
- 893af47: Add squawk Navaid packages
- 95863cd: Add squawk/procedures and squawk/procedure-data packages
- a76df6f: Standardize naming of properties/funcs and abbreviations
- 51c15dd: Add @squawk/units: Aviation unit conversion and formatting utilities
