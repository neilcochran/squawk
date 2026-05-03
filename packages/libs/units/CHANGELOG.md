# @squawk/units

## 0.4.2

### Patch Changes

- b9ff30c: ### Fixed
  - Fix the broken MIT license badge link in every package README. The relative path was one level too shallow, so on GitHub (and on npm renderers that resolve relative paths against the repo) the badge landed on a non-existent `packages/LICENSE.md` instead of the repo's `LICENSE.md`. The badge now resolves correctly.
  - Fix the broken `Documentation` link in `@squawk/flight-math`'s README. The typedoc URL slug used an underscore (`_squawk_flight_math.html`) instead of the dash form every sibling README uses (`_squawk_flight-math.html`), returning 404. Now points at the live docs page.

## 0.4.1

### Patch Changes

- b47b118: ### Changed
  - Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.

## 0.4.0

### Minor Changes

- fe443e3: - `fuel` namespace in `@squawk/units` with gal/L/lb/kg conversions
  - `FuelDensity` discriminated union (`{ kgPerL }` or `{ lbPerGal }`) for density-aware volume <-> mass conversions
  - `FUEL_DENSITY` constants for common aviation fuels: 100LL, Jet A, Jet A-1, Jet B (nominal at 15 C)
  - `mb` (millibar) and `kPa` members of `PressureUnit`, with 14 new pairwise pressure conversions routing through hPa
  - `formatFuel(value, unit, options?)` formatter with sensible per-unit precision defaults
  - `formatQNH` now accepts `mb` and `kPa` units (0 and 2 decimal defaults respectively)

## 0.3.0

### Minor Changes

- 58257db: ### Added
  - `@squawk/geo` package for shared geospatial utilities, grouping exports into `greatCircle` (`distanceNm`, `bearing`, `bearingAndDistance`, `midpoint`, `destination`) and `polygon` (`pointInPolygon`, `boundingBox`, `pointInBoundingBox`) namespaces. `greatCircle.midpoint` and `greatCircle.destination` are new capabilities; the rest are consolidated from existing packages.

  ### Removed
  - `distance.greatCircleDistanceNm` from `@squawk/units`. Moved to `@squawk/geo` as `greatCircle.distanceNm`.
  - `navigation.greatCircleBearing` and `navigation.greatCircleBearingAndDistance` from `@squawk/flight-math`. Moved to `@squawk/geo` as `greatCircle.bearing` and `greatCircle.bearingAndDistance`.

  ### Changed
  - `@squawk/airspace`, `@squawk/airports`, `@squawk/fixes`, `@squawk/navaids`, and `@squawk/flightplan` now import great-circle distance and polygon primitives from `@squawk/geo` instead of from `@squawk/units`/`@squawk/flight-math` or private internal helpers. Public APIs are unchanged.

## 0.2.2

### Patch Changes

- 9b4c21b: Update internal npm dependencies

## 0.2.1

### Patch Changes

- fe66cec: Correct READMEs and TSDoc

## 0.2.0

### Minor Changes

- 1be39b2: Add airspace data build pipeline and @squawk/airspace-data package
- 40f0b9d: Add squawk/fixes and squawk/fix-data
- c1e728c: Add squawk Navaid packages
- ba098bd: Add squawk/procedures and squawk/procedure-data packages
- ffe41f2: Standardize naming of properties/funcs and abbreviations
- 51c15dd: Add @squawk/units: Aviation unit conversion and formatting utilities
