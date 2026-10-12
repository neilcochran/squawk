---
'@squawk/airways': minor
---

### Added

- `expand()` returns `unusable`, the segments inside the expansion the FAA marks unusable, in the same index/from/to shape as `gaps`. Such a segment is still published with its waypoints and distance but has no MEA and may not be flown, so a route filing the airway across it is not valid as filed.
