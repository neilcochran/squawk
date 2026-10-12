---
'@squawk/procedures': minor
---

### Changed

- `byAirportAndRunway()` matches runway applicability the way CIFP publishes it. Besides an exact `RW<runway>` transition it matches both-parallels transitions (`RW04B` serves 04L, 04R and 04C), the `ALL` transition, and common routes published for the runway, so a query for 04L no longer misses the 564 SIDs and STARs whose runway transitions use the `B` form.
