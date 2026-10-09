---
'@squawk/procedure-data': patch
---

### Changed

- Refreshed bundled FAA CIFP snapshot to the 2026-10-29 cycle (up from 2026-09-03). New counts: 14,302 procedures (2,186 SIDs, 1,946 STARs, 10,170 IAPs).
- Hand-corrected one approach in this snapshot. The FAA's 2026-10-29 CIFP file keys the two feeder transitions (PVD and SEY) of the KOQU VOR RWY 34 approach under procedure identifier `V34`, while the approach's final and missed-approach records remain under `S34`. Taken literally that leaves `V34` as a transition-only fragment with no final approach, missed approach, or approach type, and `S34` with no feeders. Before building, the five `V34` transition records were re-keyed to `S34` in the source file; the build tool itself is unchanged. The correction is treated as valid because the transitions terminate on `S34`'s intermediate fix (JAGRA) and final approach fix (LOOOF), the result is leg-for-leg identical to the approach as published in the 2026-09-03 cycle, and no other approach in the cycle has this shape.
