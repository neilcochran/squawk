---
'@squawk/airways': minor
---

### Added

- `AirwayExpansionResult.reversed` is true when the expansion runs against the airway's published waypoint order. Each waypoint's segment fields describe the segment to the next waypoint in published order, so in a reversed expansion they describe the segment between a waypoint and the one before it.

### Changed

- The README explains how to read the waypoint fields of an expansion and states that they are returned as published: no MEA is chosen for the direction of flight.
