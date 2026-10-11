---
'@squawk/flightplan': patch
---

### Fixed

- `computeRouteDistance` and `computeRouteTiming` used a published airway segment distance of 0 as the leg length, so every airway leg measured 0 nm with the bundled data and `KLAX DCT LAX J60 SAX DCT KJFK` totalled 44 nm. A zero or missing published distance now falls back to the great-circle distance between the two points.
- An airway's entry fix was emitted twice when it was also the preceding waypoint, because the airway and fix datasets round coordinates to different precisions and the duplicate check demanded an exact match. Consecutive points within about a metre of each other are now merged, so `KLAX DCT CIVET J60 HEC DCT KLAS` no longer yields a zero-length `CIVET` to `CIVET` leg in `computeRouteDistance`, `extractRoutePoints`, or `routeToLineString`.

### Changed

- The README and TSDoc examples use `KLAX DCT LAX J60 SAX DCT KJFK`, which resolves against the bundled data. The previous `KJFK DCT MERIT J60 MARTN DCT KLAX` did not, since J60 runs between LAX and SAX. The procedure examples use `DEEZZ6` and `DEEZZ6.CANDR` in place of `NUBLE4` and `NUBLE4.JJIMY`, which are not in the bundled procedures.
