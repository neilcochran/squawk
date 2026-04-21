---
'@squawk/procedure-data': minor
---

Migrate procedure dataset to FAA CIFP (ARINC 424). Adds Instrument Approach Procedures and the full leg model on every SID, STAR, and IAP.

### Breaking changes:

- Data is now sourced from FAA CIFP instead of NASR STARDP.
- Metadata shape changed: `nasrCycleDate` -> `cifpCycleDate`; `waypointCount` -> `legCount`; added `iapCount`.
- Records expose `Procedure.identifier` instead of `computerCode`, and use the new `ProcedureLeg` model from `@squawk/types`.

### Added:

- 10,376 Instrument Approach Procedures (IAPs) covering ILS, LOC, LOC backcourse, RNAV, RNAV (RNP), VOR, VOR/DME, NDB, NDB/DME, GLS, LDA, and GPS, with approach transitions and missed-approach sequences.
- Full ARINC 424 leg model on all 201,710 legs: path terminators, altitude constraints, speed constraints, recommended navaid with theta/rho, RNP value, turn direction, and FAF/MAP/IAF/FACF/fly-over flags.
- Canadian, Pacific, Caribbean, and South Pacific procedures relevant to US operations, passed through from the FAA CIFP publication.
- Resolved lat/lon on every leg that references a fix (99.998% coverage).

Dataset now contains 14,428 procedures totaling 201,710 legs, gzipped to 2.4 MB.
