---
'@squawk/airspace-data': patch
---

### Fixed

- Special Use Airspace limits given as a height above the surface are published as AGL bounds. The FAA SAA files write the surface itself as `GND` and a number against the `SFC` reference as feet above it; the build read both as the surface, so 255 MOA, restricted, and alert area floors and 13 ceilings in the 2026-10-29 cycle were flattened to SFC (P-75 NEW YORK and LIVERMORE NSA, for example, ended at the surface instead of 1,000 ft and 800 ft AGL). One flight-level ceiling given against that reference, DOLPHIN SOUTH MOA, now resolves to FL180 instead of SFC.
