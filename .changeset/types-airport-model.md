---
'@squawk/types': minor
---

### Changed

- Breaking: `Airport.trafficPatternAltitudeFt` is renamed `trafficPatternAltitudeFtAgl`. The FAA publishes the traffic pattern altitude in feet above the field, and the old name read as MSL; 246 of the 540 published values lie below their field elevation.
- Breaking: `Airport.elevationFt` and the `identifier`, `localizerFrequencyMhz` and `localizerMagneticCourseDeg` of `IlsSystem` are required. Every bundled record carries them, and an ILS without a frequency or course is not an ILS. `artccId`, `county` and `towerType` stay optional, documented as present on every bundled record, because the type also serves consumers who bring their own data and a non-NASR airport has no ARTCC or county.
- Breaking: `Runway.pcn`, which no snapshot ever populated, is replaced by `pavementClassification`, a structured `PavementClassification` with the rating system (`PCN` or `PCR`), the value, the pavement type, the subgrade strength and tire pressure categories and the evaluation method, so an aircraft's ACN or ACR can be compared against the pavement.
- Breaking: `BORDER` is removed from `AirwayWaypointType`. NASR publishes border crossings without coordinates and the bundled airway data never carried one.

### Added

- `AirportFrequency` gains `receiveOnly` and `onRequest` (the FAA's `R` and `X` qualifiers), `provider` and `providerType` (the facility providing the service and how the FAA codes it), `callSign`, `approachCallSign` and `remark`. `frequencyMhz` documents that the HF frequencies the FAA publishes in kHz are converted to MHz.
- `RunwayEnd.rvrLocations` lists where runway visual range is measured (`TOUCHDOWN`, `MIDPOINT`, `ROLLOUT`); `hasRvr` is true whenever it is non-empty.
- `RvrLocation`, `PavementClassification`, `PavementClassificationSystem`, `PavementType`, `SubgradeStrengthCategory`, `TirePressureCategory` and `PavementEvaluationMethod`.
- TSDoc notes that `trueHeadingDeg` publishes north as both 0 and 360, that `magneticVariationYear` is carried as published (2030 and 1904 appear), and that a runway length or width is absent where the FAA publishes its 0 placeholder.
