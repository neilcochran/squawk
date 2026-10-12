---
'@squawk/airspace-data': minor
---

### Fixed

- Special Use Airspace arcs follow the FAA's direction rule: a start angle below the end angle sweeps counterclockwise and one above it clockwise. The build always swept counterclockwise, so 127 of the cycle's 269 arcs were drawn the long way round and 114 areas crossed themselves (WESTOVER 2 MOA 126 times), which made point-in-airspace answers wrong over roughly a hundred MOAs, restricted and warning areas. Arcs are now traced along the great circle, and an arc end within a nautical mile of the adjoining published corner is joined to it; six areas keep a crossing of a few hundred metres where the FAA's own corners overlap an edge.
- Arc radii published in statute miles (16 arcs in 12 areas, A-682 Travis AFB and R-2916 Cudjoe Key among them) are converted; they were read as nautical miles and drawn 15% too large.
- Every volume of a Special Use Airspace is published: the 62 additional areas the FAA codes alongside the base volume (A-682 Travis AFB's 3,000 ft shelf, the three further Birmingham 2 MOA areas) were dropped. Each is now a feature with its own floor and ceiling, as Class B rings are.
- Both parts of a multipart Class E area are published; the Key West and Dry Tortugas part of the Florida Class E5 area was missing.
- Attribute fields no longer carry the shapefile's literal `<Null>` text; the affected identifiers and schedules are empty or null.
- Every ring follows RFC 7946 (exterior counterclockwise, holes clockwise) with no consecutive duplicate vertices.

### Added

- `inclusive: false` on a floor or ceiling that excludes its own value, taken from the FAA's INCLUSIVE/EXCLUSIVE marking: 458 ceilings (MOAs designated "to but not including FL 180" and others) and 31 floors.
- `exclusions` on the 129 Special Use Airspace features the FAA publishes with volumes carved out of them (A-211 Dothan excludes three Class D areas, R-5601F Fort Sill the airspace below 5,500 ft over part of its area): a list of `{ floor, ceiling, boundary }` volumes within which the airspace does not apply.

### Changed

- The Class E ceiling beneath Class A is an exclusive 18,000 ft MSL (`inclusive: false`) rather than 17,999 ft, the same representation the exclusive Special Use Airspace limits use. Consumers comparing `valueFt` alone should read the flag.
- The README documents the identifier semantics, the empty identifiers of the Lynden and Sault Ste Marie areas (US portions of Canadian control zones), the R-2535B ceiling published at 100,000 ft above the 99,999 sentinel, and the remaining geometry quirks.
