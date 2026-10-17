---
'@squawk/types': minor
---

### Changed

- Breaking: `FixNavaidAssociation.bearingDeg` is renamed `magneticBearingDeg`, and it and `distanceNm` are optional. The bearing is magnetic for every facility type, which the old name did not say. The FAA publishes many associations with only one of the two values (a localizer course or a radial without DME, a DME fix) and some with neither, and a required pair forced the data to leave them out.
- Breaking for an exhaustive `switch`: `AircraftType` gains `other`, the FAA's category for aircraft that fit none of the rest.
- `Navaid.frequencyMhz` documents that a TACAN on a channel with no VOR-band pairing publishes 133.3 to 135.95 MHz. `magneticVariationDeg` documents that it is the variation the station is aligned to, which is what its radials are measured against, and that a DME, VOT or fan marker has none. `markerIdentifier`, `markerShape` and `markerBearingDeg` say what the FAA publishes in them.

### Added

- `AircraftRegistration.registrationStatus` with the `RegistrationStatus` union, covering every status the FAA registry publishes (valid, pending, sale reported, assigned but never registered, expired, revoked, canceled), and `registrationExpirationDate` as an ISO date. A registry record is not necessarily a current registration, and the status says which it is.
- `Navaid.remarks`, the FAA's remarks on a navaid, most of them the radials, distances and altitudes where its signal is unusable.
- `Navaid.dmeStatus`, the status of the distance-measuring component where the FAA publishes it separately from the navaid's own.
- `Navaid.checkpoints` with `NavaidCheckpoint`, `NavaidCheckpointType` and `NAVAID_CHECKPOINT_TYPE_MAP`: the published VOR receiver checkpoints.
