---
'@squawk/types': minor
'@squawk/airspace-data': minor
'@squawk/airspace': patch
'@squawk/mcp': minor
---

**@squawk/types**

### Added

- `CLASS_A` on `AirspaceType` and `AIRSPACE_TYPES`.

**@squawk/airspace-data**

### Added

- Class A airspace, which the FAA publishes as a rule rather than as geometry: one `CLASS_A` feature per domestic ARTCC HIGH stratum shape (and San Juan's combined stratum), carrying 18,000 ft MSL to FL600 over the stratum's polygon. Honolulu and the oceanic centers have no HIGH stratum and get none, as 14 CFR 71.33 designates no Class A there. Each feature is named `CLASS A` with an empty identifier; adjacent centers' polygons abut, so dedupe by type for a single answer.

**@squawk/airspace**

### Changed

- README documents Class A coverage and the dedupe note.

**@squawk/mcp**

### Added

- `query_airspace_at_position` and `search_airspace` accept `CLASS_A` as a type filter, and the position query describes Class A coverage.
