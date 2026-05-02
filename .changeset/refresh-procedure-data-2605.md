---
'@squawk/procedure-data': minor
---

### Changed

- Refreshed bundled FAA CIFP snapshot to the 2026-05-14 cycle (14,306 procedures: 2,204 SIDs, 1,851 STARs, 10,251 IAPs).

### Fixed

- `properties.cifpCycleDate` now carries the AIRAC cycle effective date (e.g. `2026-05-14`) instead of the FAA file-publish date that appears in the CIFP HDR01 record (e.g. `2026-04-22`). The publish date is typically ~3 weeks before the cycle takes effect, so the previous value made bundled snapshots look ~3 weeks older than the cycle they actually represent. Consumers reading `cifpCycleDate` to display "data current as of" or to compare against AIRAC schedules will now see the correct date.
