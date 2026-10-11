---
'@squawk/airways': minor
---

### Added

- `expand()` results carry `gaps`, the published discontinuities inside the expansion in traversal order. The FAA discontinues some airways partway (J60 between JOT and DJB, for example) and flags the waypoint after which the airway stops, but expansions crossed those gaps silently. The waypoints on both sides are still returned; an empty `gaps` means the segment is continuous, and a non-empty one means the airway is not defined between the named waypoints.
