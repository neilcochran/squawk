---
'@squawk/airways': patch
---

### Changed

- The README and TSDoc `expand` examples use `expand('J70', 'SEA', 'GEP')`, which expands nine waypoints with no gap. The previous `expand('J60', 'LAX', 'SAX')` spans J60's published gap between JOT and DJB, so the example came back with a non-empty `gaps`.
