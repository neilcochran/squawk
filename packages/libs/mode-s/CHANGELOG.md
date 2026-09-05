# @squawk/mode-s

## 0.3.1

### Patch Changes

- ea8a9e4: ### Fixed

  - DF16 (long air-air surveillance reply) no longer decodes its MV field as an ACAS Resolution Advisory report unless the field's own register identifier actually says BDS 3,0 - MV is a general-purpose Comm-B register slot and can legitimately carry other register content, which was previously misread as a phantom (often "active") Resolution Advisory.

## 0.3.0

### Minor Changes

- 9015223: ### Added

  - `decodeFlightStatus(fsField)` decodes a DF4/5/20/21 surveillance reply's 3-bit Flight Status field into Alert and Ident flags. `SurveillanceAltitudeReply`, `CommBAltitudeReply`, `SurveillanceIdentityReply`, and `CommBIdentityReply` now carry the results as `identActive`/`squawkAlert`.

  ### Changed
  - `TargetStateAndStatus`, `AcasResolutionAdvisoryReport`, `ResolutionAdvisoryType`, `AcasThreat` (and its member types `AcasThreatType`/`AcasThreatNone`/`AcasThreatIcaoAddress`/`AcasThreatAltitudeRangeBearing`), and `EmergencyState` now live in `@squawk/types` and are re-exported here - existing imports from `@squawk/mode-s` are unaffected.

### Patch Changes

- Updated dependencies [9015223]
  - @squawk/types@0.9.0

## 0.2.0

### Minor Changes

- 65a8c9b: ### Changed

  - `ExtendedSquitterPosition.altitudeFt` replaced by `baroAltitudeFt`/`geoAltitudeFt` (mutually exclusive per message) - the single field previously conflated barometric (type codes 9-18, and the type-code-0 no-fix case) and GNSS-height (20-22) airborne position altitude with no way to tell which one a given message carried. Consumers reading `.altitudeFt` off a decoded `extendedSquitterPosition` message should switch to `.baroAltitudeFt` (the common case) or check both.

## 0.1.0

### Minor Changes

- 871a15d: **@squawk/mode-s** decodes raw Mode-S/ADS-B messages: downlink format and CRC extraction, CPR position, airborne velocity, aircraft identification, altitude (both the ADS-B position-message field and legacy Gillham-coded surveillance replies), squawk identity, emergency status, ACAS/TCAS Resolution Advisories, target state and status, aircraft operational status, and Enhanced Surveillance Comm-B registers (BDS 4,0/5,0/6,0). Transport-agnostic - operates on already-framed message bytes regardless of source.
