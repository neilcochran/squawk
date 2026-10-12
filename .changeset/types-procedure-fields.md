---
'@squawk/types': minor
---

### Added

- `ProcedureLeg.verticalAngleDeg`, `turnDirectionValid`, `gnssFmsIndication`, `routeTypeQualifier1` and `routeTypeQualifier2`, and `Procedure.transitionAltitudeFt`, for the CIFP leg fields the procedure data now carries. The three codes are typed as `GnssFmsIndication`, `ApproachRouteQualifier1` and `ApproachRouteQualifier2`, with every ARINC 424 value documented. `TurnDirection` accepts `E` (either direction).

### Changed

- `SpeedConstraintDescriptor`, `ProcedureCommonRoute.runway`, `Procedure.name` and `Procedure.runway` docs describe the mandatory meaning of `@`, the `B` both-parallels runway convention, indicator-letter and `COPTER` names, and course-named approaches.
