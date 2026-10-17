---
'@squawk/navaids': minor
---

### Added

- `nearest`, `search` and `byFrequency` accept `statuses`, a set of operational statuses to include, and `publicUseOnly`, which keeps only navaids open to public use. Restricted, VFR-only and non-public navaids could not be told apart in these queries before.
