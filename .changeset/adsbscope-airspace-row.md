---
'@squawk/adsbscope': minor
---

### Added

- An `Airspace` row on the inspect panel naming every Class B, C, or D and special-use area - restricted, prohibited, warning, and alert areas, MOAs, and national security areas - containing the selected aircraft, special-use first: `R-4001A BRUNSWICK, Class D (NHZ)`. It is resolved on the server from the bundled airspace data against the aircraft's altitude as well as its position, so unlike the drawn boundary it says whether an aircraft is under a Class B shelf or in it. An aircraft in none of them reads `outside Class B, C, and D`; one with no altitude has no row, since it cannot be placed.
