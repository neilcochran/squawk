---
'@squawk/adsb-feed': minor
---

### Added

- `isEmergencyAircraft()` reports whether an `Aircraft` is in an emergency: an emergency squawk, a declared emergency state, or an active ACAS/TCAS Resolution Advisory. Any one is sufficient, since which of them a feed can see depends on its source. It is built from `isEmergencySquawk()` (7500, 7600, or 7700, also exported as the `EMERGENCY_SQUAWKS` set) and `isDeclaredEmergencyState()` (any `EmergencyState` other than `'none'` and `'reserved'`), which are exported too. All are pure and available from the browser entry point as well.
