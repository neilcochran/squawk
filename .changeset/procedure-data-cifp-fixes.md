---
'@squawk/procedure-data': minor
---

### Fixed

- Runway legs resolve against the procedure's own airport. CIFP runway records were indexed by runway identifier and region only, so `RW26` at one airport overwrote `RW26` at every other airport in the region, and 8,387 of the 9,102 runway-terminated legs (final approach segments and SID/STAR runway transitions) carried another airport's threshold, in some cases hundreds of miles away.
- RF (constant radius arc) legs carry the published radius. It was ten times too small on all 1,450 of them because the ARINC field is in thousandths of a nautical mile, not ten-thousandths.
- A blank CIFP speed descriptor is a mandatory speed (`@`), as ARINC 424 defines it. It was published as "at or below" (`-`) on 5,516 constraints, almost every STAR speed restriction among them.
- Approach names carry the multiple-approach indicator (`RNAV Y RWY 21`, `ILS Z RWY 01L`), so the 445 approaches that shared a name with a sibling at the same airport are distinguishable, and helicopter approaches are prefixed `COPTER`. Approaches named by final approach course (`R027`) are named `RNAV 027` and no longer report runway `02`.
- `ProcedureCommonRoute.runway` is populated on the 46 common routes CIFP publishes for a single runway.
- `rnpNm` values no longer carry binary floating-point noise such as `0.30000000000000004`.

### Added

- Legs carry the CIFP fields the build previously skipped: `verticalAngleDeg` on the 14,781 final approach legs that publish a vertical path, `turnDirectionValid` on the 1,475 legs whose turn direction is mandatory, and the ARINC 424 `gnssFmsIndication`, `routeTypeQualifier1` and `routeTypeQualifier2` codes on approach legs, where qualifier 2 separates straight-in, circling and copter approaches. Either-direction turns (`E`) are kept. Every procedure carries `transitionAltitudeFt`.

### Changed

- The README lists the snapshot's coverage limits and known source quirks.
