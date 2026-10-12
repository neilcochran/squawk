---
'@squawk/types': minor
---

### Added

- `AltitudeBound.inclusive`, `false` when a bound excludes its own value; `AirspaceVolume`, a polygon between a floor and a ceiling; and `AirspaceFeature.exclusions`, the volumes carved out of a feature.

### Changed

- `AirspaceFeature` docs describe the identifier semantics per type, `controllingFacility` as the controlling ARTCC of Special Use Airspace and null elsewhere, the one published ceiling above the 99,999 sentinel, the multi-feature airspaces, and the exclusive Class E ceiling beneath Class A.
