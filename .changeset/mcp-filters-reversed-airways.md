---
'@squawk/mcp': minor
---

### Added

- `find_nearest_navaids`, `search_navaids` and `find_navaids_by_frequency` accept `navaidStatuses` and `publicUseOnly`.
- `find_nearest_airports` and `search_airports` accept `useTypes` (`PUBLIC`, `PRIVATE`).

### Fixed

- `compute_route_distance`, `get_route_timing` and `get_route_geometry` measure an airway flown against its published order correctly.

### Changed

- `expand_airway_segment` describes the new `reversed` flag and how to read segment fields with it. `compute_route_distance` says that no altitude or procedure constraint is checked.
