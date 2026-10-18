---
'@squawk/flightplan': minor
---

### Fixed

- A STAR is matched to the route's arrival airport, the first airport after it, instead of the last airport before it, which was the departure airport. Many identifiers are published as a separate adaptation at each of several airports with different legs, so a correctly filed STAR came back as another airport's adaptation: `KJFK LUCIT3 KIGQ` expanded the 05C adaptation of LUCIT3. 176 of the 293 STARs published at more than one airport expand differently at each.
- A token that is both an airport's FAA identifier and a navaid resolves as the navaid when it is directly followed by an airway that lists it, the point the airway is joined at. It resolved as the airport, which can be miles from the navaid (86 of the 397 such identifiers on airways are more than 5 nm apart), so `SAT Q24 LSU` started at San Antonio's airport 6.6 nm from the SAT VORTAC, and `SJN J108 INK` drew a 13 nm leg from St Johns' airport to the SJN VORTAC. Anywhere else the token is still the airport, and an ICAO code always is.

### Added

- `sid` and `star` route elements carry `airportMismatch`, the route's departure or arrival airport, when no published adaptation of the procedure serves it. The procedure is still expanded, from the first adaptation, so the route draws and measures, but it is not valid as filed. `KJFK DCT BBOTL AALLE4 KBOS` expanded Denver's AALLE4 with no sign anything was wrong.
