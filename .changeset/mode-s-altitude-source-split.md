---
'@squawk/mode-s': minor
---

### Changed

- `ExtendedSquitterPosition.altitudeFt` replaced by `baroAltitudeFt`/`geoAltitudeFt` (mutually exclusive per message) - the single field previously conflated barometric (type codes 9-18, and the type-code-0 no-fix case) and GNSS-height (20-22) airborne position altitude with no way to tell which one a given message carried. Consumers reading `.altitudeFt` off a decoded `extendedSquitterPosition` message should switch to `.baroAltitudeFt` (the common case) or check both.
