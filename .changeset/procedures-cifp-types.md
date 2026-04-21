---
'@squawk/types': minor
---

Expand the procedure type system for full ARINC 424 coverage of SIDs, STARs, and IAPs.

### Breaking changes:

- Remove `ProcedureWaypoint`, `ProcedureWaypointTypeCode`, `ProcedureWaypointCategory`, `PROCEDURE_TYPE_MAP`, and `PROCEDURE_WAYPOINT_CATEGORY_MAP`. Use `ProcedureLeg` and `ProcedureLegFixCategory` instead.
- Rename `Procedure.computerCode` to `Procedure.identifier`. The field now carries CIFP identifiers for IAPs (e.g. `"I04L"`) as well as SID/STAR identifiers (e.g. `"AALLE4"`).
- Rename `ProcedureTransition.waypoints` and `ProcedureCommonRoute.waypoints` to `.legs`.
- `ProcedureType` now includes `'IAP'`; `switch` statements on procedure type must handle the new variant.

### Added:

- `ProcedureLeg` with the full ARINC 424 leg model: path terminator, altitude constraint, speed constraint, course, distance, RNP, turn direction, recommended navaid, fly-over / FAF / MAP / IAF / FACF flags.
- `ProcedureLegPathTerminator` union of 23 ARINC 424 codes (`IF`, `TF`, `CF`, `DF`, `CA`, `CI`, `CR`, `FA`, `FC`, `FD`, `FM`, `HA`, `HF`, `HM`, `PI`, `RF`, `AF`, `VA`, `VI`, `VM`, `VR`, `VD`, `CD`).
- `ApproachType` for IAP classification (`ILS`, `LOC`, `LOC_BC`, `RNAV`, `RNAV_RNP`, `VOR`, `VOR_DME`, `NDB`, `NDB_DME`, `TACAN`, `GLS`, `IGS`, `LDA`, `SDF`, `GPS`, `FMS`, `MLS`).
- `AltitudeConstraint`, `AltitudeConstraintDescriptor`, `SpeedConstraint`, `SpeedConstraintDescriptor`, `MissedApproachSequence`, `TurnDirection`, `ProcedureLegFixCategory`.
- Optional `Procedure.approachType`, `Procedure.runway`, `Procedure.missedApproach` populated for IAPs.
- Optional `ProcedureCommonRoute.runway` for runway-tagged routes.
