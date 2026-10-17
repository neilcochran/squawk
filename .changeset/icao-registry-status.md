---
'@squawk/icao-registry': minor
---

### Added

- `parseFaaRegistryZip` reads the registration status and expiration date into `registrationStatus` and `registrationExpirationDate`. The FAA registry lists pending, sale-reported, expired and revoked registrations beside valid ones, and a record gave no way to tell them apart. The `RegistrationStatus` type is exported beside the other registration types.
- Aircraft the FAA types as `O` (other) get the `other` aircraft type instead of none.

### Fixed

- The FAA's `REGISTRATION PENDING` and `SALE REPORTED` placeholder names are no longer returned as the operator.
- A year of manufacture of 0, the FAA's value for an unknown year, is left unset.
