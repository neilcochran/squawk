---
'@squawk/mcp': minor
---

Rewrite and expand the procedure tool surface to cover the new CIFP-sourced procedure resolver.

### Breaking changes:

- Remove `get_procedure_by_code`. Replaced by `find_procedures_by_identifier` (returns all matches across airports) and `get_procedure_by_airport_and_identifier` (resolves a specific adaptation).
- `expand_procedure` now requires `airportId` in addition to `identifier`; the result's `expansion` object exposes `legs` instead of `waypoints`.
- `get_dataset_status` procedures entry now reports `cifpCycleDate`, `iapCount`, and `legCount` (previously `nasrCycleDate` and `waypointCount`).

### Added:

- `find_procedures_by_identifier` returns every procedure publishing a CIFP identifier across airports.
- `get_procedure_by_airport_and_identifier` resolves a single procedure at a specific airport.
- `find_procedures_by_airport_and_runway` finds IAPs serving a runway plus SIDs/STARs with a matching runway transition.
- `find_approaches_by_type` returns every IAP of a given approach classification (ILS, RNAV, VOR, NDB, etc.).
- `search_procedures` accepts an `approachType` filter and accepts `'IAP'` as a `procedureType` value.
- `expand_procedure` supports IAPs (approach transitions merge before the final approach segment).
