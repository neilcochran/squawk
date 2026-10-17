---
'@squawk/icao-registry-data': minor
---

### Added

- Every record carries `registrationStatus`, and valid registrations their `registrationExpirationDate`. About 2% of records are not valid registrations: pending, sale reported, assigned but never registered, expired, revoked or canceled.

### Fixed

- About 3,500 pending and sale-reported registrations no longer name the FAA's `REGISTRATION PENDING` or `SALE REPORTED` placeholder as their operator.
- No record carries a year of manufacture of 0, and the 19 aircraft the FAA types as other are typed `other`.

### Changed

- Refreshed the snapshot from the FAA registry of 2026-10-13 (317,551 records).
- The README describes the record fields and the limits of the data.
