---
'@squawk/flightplan': minor
'@squawk/mcp': patch
---

**@squawk/flightplan**

### Added

- `checkRouteAltitudes` uses the minimum obstruction clearance altitude (MOCA). A leg below its applicable MEA but at or above the MOCA now passes, with a `belowMeaAllowance` naming the basis and its cautions, when the equipment includes `gnss`, or includes `conventional` and every point of the leg is within 22 NM of the VOR it is navigated by: the nearest VOR along the airway behind and ahead of the leg, switching at the published changeover point or else midway. Otherwise it fails as before, with the new `mocaBeyondVorRange` code when it goes beyond 22 NM, and below the MOCA it fails with `belowMoca` for any equipment. Each airway leg also reports its `minimumObstructionClearanceAltitudeFt`.

**@squawk/mcp**

### Changed

- `check_route_altitudes` describes the MOCA allowance below the MEA.
