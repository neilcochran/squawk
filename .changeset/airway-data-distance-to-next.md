---
'@squawk/airway-data': patch
---

### Fixed

- Every waypoint's `distanceToNextNm` was 0. NASR fills the AWY1 and ATS1 "distance to next point" field with `000.00` and publishes the real value in the "distance to next point in segment" field, which the build only read when the first was blank. The 2026-10-29 snapshot now carries the published distance on 17,371 of its 19,081 waypoints (LAX to PDZ on J60 is 45.05 nm). The field is left unset, rather than 0, where the FAA's value does not describe a leg to the next waypoint in the sequence: the last waypoint of an airway, a waypoint after which the airway is discontinued (J60 between JOT and DJB), and a waypoint whose successor is a border crossing without coordinates.
