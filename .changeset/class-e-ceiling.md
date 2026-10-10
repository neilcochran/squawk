---
'@squawk/airspace-data': minor
'@squawk/types': patch
'@squawk/airspace': patch
'@squawk/mcp': patch
---

**@squawk/airspace-data**

### Changed

- Class E areas beneath Class A carry a ceiling of 17,999 ft MSL instead of the 99,999 undefined-ceiling sentinel. NASR leaves the upper limit of nearly every Class E area undefined because 14 CFR 71.71 ends those areas at the overlying controlled airspace, so an altitude query at or above 18,000 ft returned Class E alongside Class A. The build now resolves that for every Class E area whose polygon overlaps a Class A feature. Class E outside Class A (Hawaii and the Pacific territories) keeps the sentinel, published Class E ceilings are kept, and Special Use Airspace with an undefined ceiling is untouched, since it genuinely extends through Class A.

**@squawk/types**

### Changed

- `AltitudeBound` and `AirspaceType` docs describe the 99,999 undefined-ceiling sentinel and the Class E ceiling beneath Class A.

**@squawk/airspace**

### Changed

- README documents the Class E ceiling beneath Class A and its effect on `query()`.

**@squawk/mcp**

### Changed

- `query_airspace_at_position` describes the Class E ceiling beneath Class A, so a vertical profile at 18,000 ft and above returns Class A rather than the Class E area under it.
