---
'@squawk/flightplan': minor
---

### Added

- Airway route elements carry `gaps`, the published discontinuities their expansion crosses, and every `RouteLeg` and `RouteTimingLeg` carries `crossesGap`, true when the leg spans one. A route that files an airway across a gap (`KLAX DCT LAX J60 SAX DCT KJFK` crosses the JOT to DJB gap) was accepted without comment and bridged with a straight leg. The leg is still measured and counted so the route can be drawn and totalled, but it is now flagged so callers can tell the route is not valid as filed. A `FlightplanAirwayLookup` may return `gaps` from `expand()` to supply them; one that omits it reports none.
