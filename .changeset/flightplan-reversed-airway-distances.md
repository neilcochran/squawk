---
'@squawk/flightplan': minor
---

### Fixed

- A route that flies an airway against its published waypoint order is measured correctly. Each leg took the published distance of a neighbouring segment, and the first leg the distance of a segment outside the route, so `BLD J60 CIVET` measured 300.7 nm instead of 171.2. `computeRouteDistance`, `computeRouteTiming` and the route geometry all used the wrong values.

### Added

- `AirwayRouteElement.reversed` says whether the route flies the airway against its published order, and `FlightplanAirwayLookup.expand` may return it.

### Changed

- An airway lookup that does not report `reversed` gets great-circle leg distances for that airway instead of the published ones, which are only correct when the direction is known.
- The README states what the resolver does not check: airway altitudes and their directions, procedure constraints, and the airway changeover, signal-gap and US-airspace-only fields are carried as published and never validated.
