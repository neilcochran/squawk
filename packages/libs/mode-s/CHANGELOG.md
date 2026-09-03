# @squawk/mode-s

## 0.2.0

### Minor Changes

- 65a8c9b: ### Changed

  - `ExtendedSquitterPosition.altitudeFt` replaced by `baroAltitudeFt`/`geoAltitudeFt` (mutually exclusive per message) - the single field previously conflated barometric (type codes 9-18, and the type-code-0 no-fix case) and GNSS-height (20-22) airborne position altitude with no way to tell which one a given message carried. Consumers reading `.altitudeFt` off a decoded `extendedSquitterPosition` message should switch to `.baroAltitudeFt` (the common case) or check both.

## 0.1.0

### Minor Changes

- 871a15d: **@squawk/mode-s** decodes raw Mode-S/ADS-B messages: downlink format and CRC extraction, CPR position, airborne velocity, aircraft identification, altitude (both the ADS-B position-message field and legacy Gillham-coded surveillance replies), squawk identity, emergency status, ACAS/TCAS Resolution Advisories, target state and status, aircraft operational status, and Enhanced Surveillance Comm-B registers (BDS 4,0/5,0/6,0). Transport-agnostic - operates on already-framed message bytes regardless of source.
