---
'@squawk/flightplan': minor
---

## Added

- Add `computeRouteDistance()` for computing total great-circle route distance and estimated time enroute from a parsed route
- Add `RouteLeg` interface representing a single leg between two geographic points, including distance and cumulative distance in nautical miles
- Add `RouteDistanceResult` interface containing leg-by-leg breakdown, total distance, optional ETE, and any unresolved route elements
