---
'@squawk/mcp': patch
---

### Changed

- `expand_airway_segment` results and the airway elements from `parse_flightplan_route` include `gaps`, and the legs from `compute_route_distance` and `get_route_timing` include `crossesGap`, so a route that files an airway across a published discontinuity (J60 between JOT and DJB) is reported instead of silently bridged. The tool descriptions explain the fields.
