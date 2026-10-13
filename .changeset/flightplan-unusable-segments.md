---
'@squawk/flightplan': minor
---

### Added

- Airway route elements carry `unusable`, the segments of the expansion the FAA marks unusable, beside `gaps`, and `RouteLeg` and the timing legs carry an `unusable` flag beside `crossesGap`, so a route across such a segment is measured and timed like any other but can be reported as not valid as filed. An airway lookup that cannot report unusable segments may omit them.
