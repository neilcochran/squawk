---
'@squawk/mcp': patch
---

### Changed

- `parse_flightplan_route` matches a STAR to the route's arrival airport and a SID to its departure airport, reports `airportMismatch` on a procedure filed at an airport none of its adaptations serves, and resolves an airport identifier that is also a navaid as the navaid when an airway that lists it follows. The tool description explains the behaviour.
