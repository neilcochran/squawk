---
'@squawk/flightplan': minor
'@squawk/mcp': patch
---

**@squawk/flightplan**

### Added

- Each leg from `checkRouteAltitudes` carries a `cruisingAltitude` check of whether its altitude suits the direction of flight under the east/west rule of 14 CFR 91.179(b): odd thousands of feet for a magnetic course of 0 to 179 degrees and even thousands for 180 to 359, with RVSM levels up to FL410 and 4000 ft spacing above. It reports `appropriate`, `inappropriate` (naming the nearest cruising altitudes) or `notDeterminable`, with the magnetic course used: the airway's published course in the direction flown, or else the great-circle course converted to magnetic with the World Magnetic Model. SID and STAR legs are not checked. The check is advisory and does not change any `status`.

**@squawk/mcp**

### Changed

- `check_route_altitudes` describes the advisory `cruisingAltitude` check on each leg.
