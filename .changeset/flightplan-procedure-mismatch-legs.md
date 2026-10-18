---
'@squawk/flightplan': minor
---

### Added

- `RouteLeg` and `RouteTimingLeg` carry `procedureAirportMismatch`, true when the leg runs along a SID or STAR the route files at an airport it does not serve (the element's `airportMismatch`), or joins the route to that airport: the leg in from the departure airport for a SID, the leg out to the arrival airport for a STAR. A consumer can draw or report those legs the way it does `crossesGap` and `unusable`. In `KJFK DCT BBOTL AALLE4 KBOS` they are AALLE4's legs and the 1,486 nm leg from HEDDD to KBOS.
