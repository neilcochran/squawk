---
'@squawk/mcp': patch
---

### Changed

- `compute_route_distance` and `get_route_timing` report `procedureAirportMismatch` on each leg that runs along or into a SID or STAR filed at an airport it does not serve, and their descriptions explain it.
