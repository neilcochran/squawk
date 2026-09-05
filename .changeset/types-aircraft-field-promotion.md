---
'@squawk/types': minor
---

### Added

- `Aircraft` gains five new optional fields for previously-undecodable ADS-B/Mode-S data: `emergencyState`, `resolutionAdvisory`, `targetState`, `identActive`, `squawkAlert`.
- `EmergencyState`, `TargetStateAndStatus`, `AcasResolutionAdvisoryReport`, `ResolutionAdvisoryType`, and the `AcasThreat` union (`AcasThreatType`, `AcasThreatNone`, `AcasThreatIcaoAddress`, `AcasThreatAltitudeRangeBearing`) - promoted from `@squawk/mode-s`, which re-exports them for backward compatibility.
