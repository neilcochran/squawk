---
'@squawk/airway-data': minor
---

### Fixed

- Minimum crossing altitudes sit on the waypoint they apply at. NASR publishes each MCA on a segment record together with the point it applies at, which is the record's own point in 42 of 997 cases and up to eight points further along otherwise; the snapshot attached every MCA to the record's point, so `J70` carried its 25,000 ft westbound crossing restriction at NICKL instead of AUGER. The one MCA the FAA publishes without naming its point (`T291`, 3,800 ft NE BND, on the MORTO record) is attached to Selinsgrove, where Part 95 Amendment 580 raises the MEA from 3,300 to 3,800 ft northeast-bound and the record's own Part 95 next-MEA-point column names SEG.
- Altitude directions appear only with an altitude and only in the FAA's eight compass forms. NASR writes a bare `BND` template in every direction column, which the snapshot carried as a direction on 74,271 waypoint fields that have no altitude.

### Added

- `unusable` marks the 72 segments the FAA publishes but does not allow to be flown, taken from the source's MEA GAP column or an `UNUSABLE` point remark; they keep their waypoints and distance and have no MEA.
- The 37 special routes the FAA publishes in ATS.txt (`SPZK214` and others, 290 waypoints), which the build used to drop, ship with the `SPECIAL` type.
- DME/DME/IRU MEAs with their directions, the magnetic variation at navaid waypoints, RNP where published, and the FAA's point and route remarks.
- The README lists what the snapshot leaves out or carries as published: border crossings without coordinates, the changeover navaid records, the MEA GAP `N` value, duplicate CONUS and Hawaii designations, the legs without a published distance and the segments without an MEA.
