---
'@squawk/types': minor
---

### Changed

- Breaking: `AirwayWaypoint.dmeDmeIruMinimumEnrouteAltitudeOppositeFt` and `dmeDmeIruMinimumEnrouteAltitudeOppositeDirection` are removed. No FAA airway record has populated them, and the FAA's current CSV airway format does not define an opposite-direction DME/DME/IRU MEA. `dmeDmeIruMinimumEnrouteAltitudeDirection` stays, documented as unset on every current record.
