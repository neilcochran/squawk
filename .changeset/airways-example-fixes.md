---
'@squawk/airways': patch
---

### Fixed

- The README and `createAirwayResolver` example expand `J60` between `LAX` and `SAX`, which the bundled data resolves; the previous `MERIT` to `MARTN` pair is not on J60. The README example also read the MEA from a `mea` property that does not exist on a waypoint; it now reads `minimumEnrouteAltitudeFt`.
