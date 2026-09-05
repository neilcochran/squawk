---
'@squawk/mode-s': minor
---

### Added

- `decodeFlightStatus(fsField)` decodes a DF4/5/20/21 surveillance reply's 3-bit Flight Status field into Alert and Ident flags. `SurveillanceAltitudeReply`, `CommBAltitudeReply`, `SurveillanceIdentityReply`, and `CommBIdentityReply` now carry the results as `identActive`/`squawkAlert`.

### Changed

- `TargetStateAndStatus`, `AcasResolutionAdvisoryReport`, `ResolutionAdvisoryType`, `AcasThreat` (and its member types `AcasThreatType`/`AcasThreatNone`/`AcasThreatIcaoAddress`/`AcasThreatAltitudeRangeBearing`), and `EmergencyState` now live in `@squawk/types` and are re-exported here - existing imports from `@squawk/mode-s` are unaffected.
