# @squawk/procedure-data

## 0.5.1

### Patch Changes

- Updated dependencies [d72e966]
  - @squawk/types@0.6.0

## 0.5.0

### Minor Changes

- 772b90d: Migrate procedure dataset to FAA CIFP (ARINC 424). Adds Instrument Approach Procedures and the full leg model on every SID, STAR, and IAP.

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

### Patch Changes

- Updated dependencies [772b90d]
  - @squawk/types@0.5.0

## 0.3.3

### Patch Changes

- 51a9ddc: - Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
- Updated dependencies [51a9ddc]
  - @squawk/types@0.3.1

## 0.3.2

### Patch Changes

- d52b90b: Update internal npm dependencies
- Updated dependencies [d52b90b]
  - @squawk/types@0.2.2

## 0.3.1

### Patch Changes

- 8563ada: Make the bundled data source data more visible in squawk/ data package READMEs

## 0.3.0

### Minor Changes

- 6f91bf8: Update bundled data from FAA NASR cycle effective 2026-04-16

### Patch Changes

- 16d7bf1: Correct READMEs and TSDoc
- Updated dependencies [16d7bf1]
  - @squawk/types@0.2.1

## 0.2.0

### Minor Changes

- 95863cd: Add squawk/procedures and squawk/procedure-data packages

### Patch Changes

- Updated dependencies [fc890a7]
- Updated dependencies [896ce8a]
- Updated dependencies [58a8dec]
- Updated dependencies [feaa9ab]
- Updated dependencies [a41e8da]
- Updated dependencies [b28de20]
- Updated dependencies [ec14992]
- Updated dependencies [005c963]
- Updated dependencies [893af47]
- Updated dependencies [5999218]
- Updated dependencies [f9cb361]
- Updated dependencies [303997a]
- Updated dependencies [53b25b2]
- Updated dependencies [2bdf6be]
- Updated dependencies [c7edad0]
- Updated dependencies [c4b7790]
- Updated dependencies [a76df6f]
- Updated dependencies [062f661]
  - @squawk/types@0.2.0
