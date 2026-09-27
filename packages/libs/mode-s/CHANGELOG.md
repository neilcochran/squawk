# @squawk/mode-s

## 0.4.0

### Minor Changes

- a0f2ee1: **@squawk/mode-s**

  ### Added
  - Airborne position messages now carry `surveillanceStatus`, decoded from their Surveillance Status field: `none`, `permanentAlert` (an emergency squawk), `temporaryAlert` (a recent change to any other squawk), or `ident`. Position messages are broadcast twice a second whether or not the aircraft is being interrogated, so they report an alert or an ident far more often than the Flight Status of a DF4/5/20/21 reply. It is undefined for surface positions, which have no such field.
  - `decodeSurveillanceStatus()` and the `SurveillanceStatus` type, for callers decoding a raw ME field themselves.

  **@squawk/adsb-feed**

  ### Changed
  - The Beast source now updates `identActive` and `squawkAlert` from airborne position messages as well as from Mode-S surveillance replies, reading the Surveillance Status the way dump1090-fa does. Both flags now follow the transponder for any aircraft broadcasting its position, not only while a radar is interrogating it, and an ident or alert that has ended clears within a second or so instead of lingering until the next reply.

  ### Fixed
  - The SBS source now reads the BaseStation alert, SPI, and on-ground flags as dump1090-fa writes them, where `-1` means true. It accepted only `1` before, so on an SBS feed `onGround`, `squawkAlert`, and `identActive` were never true: an aircraft on the ground kept its last airborne state, and ident and squawk-change alerts never registered. `1` is still read as true.

  **@squawk/adsbtop**

  ### Changed
  - With `--source beast`, the detail view's `Squawk alert` and `Ident active` rows now follow the aircraft's position broadcasts, so they turn on and off within a second or so of the transponder rather than waiting for its next interrogation reply.

  ### Fixed
  - With `--source sbs`, an aircraft on the ground now shows `GND` in the `Grnd` column and matches `is:ground` rather than `is:airborne`, and the detail view's `Squawk alert` and `Ident active` rows show `Yes` when set.

  **@squawk/adsbscope**

  ### Fixed
  - With `--source sbs`, an aircraft on the ground is now shown as on the ground - `GND` for altitude, and in the digital view style a hollow symbol with no velocity vector - instead of keeping its last airborne altitude.

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
