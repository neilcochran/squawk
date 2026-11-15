---
'@squawk/procedure-data': patch
'@squawk/types': patch
---

**@squawk/procedure-data**

### Fixed

- Mandatory "at" altitude constraints are no longer dropped. The CIFP codes an "at" altitude with a blank descriptor, which the build discarded, so 16,434 legs (11,886 on approaches, 4,405 on STARs, 143 on SIDs) had no `altitudeConstraint`. They now carry the `@` descriptor with their altitude. Nothing else in the snapshot changes.

### Changed

- README notes that constraint altitudes can be negative: approaches to the four airports below sea level in the Imperial and Coachella valleys publish at-altitudes down to -145 ft.

**@squawk/types**

### Changed

- The `AltitudeConstraintDescriptor` docs describe `@` as the mandatory "at" altitude, which the CIFP publishes with a blank descriptor.
