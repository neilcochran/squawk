---
'@squawk/fix-data': minor
---

### Fixed

- Every navaid association the FAA publishes is included: 26,260, up from 19,099. The build left out any association without both a bearing and a distance, which removed localizer courses, radials from a VOR without DME and DME-only fixes, and left 1,503 fixes with no defining facility at all.

### Changed

- Breaking: a navaid association's `bearingDeg` is now `magneticBearingDeg`, and it and `distanceNm` are present only where the FAA publishes them. Check each for `undefined`.
- The README documents the association fields and the known issues: 21 associations whose published bearing or distance disagrees with the two positions, the offshore area codes in `state`, the `IB` country code, and the fixes at the pole, on the antimeridian and on the equator.
