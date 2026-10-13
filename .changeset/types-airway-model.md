---
'@squawk/types': minor
---

### Added

- `SPECIAL` joins `AirwayType` for the FAA's non-regulatory `ZK` special routes: low-level RNAV routes used mainly by helicopter air ambulance operators, not on public charts and filed only with FAA Flight Standards approval. `ATS_TYPE_MAP` maps the `SP` prefix to it.
- `AirwayDirection`, `AIRWAY_DIRECTIONS` and `isAirwayDirection` model the eight `BND` directions of travel an airway altitude can apply to.
- `AirwayWaypoint` gains `unusable` (the segment starting at the waypoint may not be flown), `remarks`, `magneticVariationDeg` and `magneticVariationDirection` at navaid waypoints, `rnpNm`, and the four DME/DME/IRU MEA fields; `Airway` gains `remarks`.
- `AirwaySegmentReference` names a segment of an airway expansion by index and endpoint identifiers, so gaps and unusable segments share one shape; `AirwayGap` is now an alias of it.

### Changed

- Every airway altitude direction field is typed `AirwayDirection` instead of `string` and is present only with its altitude.
- The minimum crossing altitude fields are documented at the waypoint the FAA names for them, `BORDER` is documented as a reserved waypoint type the bundled data never carries, and `state` and `icaoRegionCode` document NASR's pseudo-codes and the single-letter offshore region codes.
