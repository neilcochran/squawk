---
'@squawk/adsbscope': minor
---

### Added

- The inspect panel's `Airspace` row names Class A, which the bundled airspace data now carries: an aircraft at or above 18,000 ft MSL over the contiguous states, Alaska, or Puerto Rico reads `Class A`, after any special-use area it is also in (`W-102H HIGH, Class A`). An aircraft in none of the reported airspace now reads `outside Class A, B, C, D`.

### Fixed

- A bookmarked selection (`?selected=<hex>`) is honored again on reload. The URL's hex was lowercased on the way in while every feed spells hexes in uppercase, so the aircraft was never found and the selection was dropped on the first snapshot. The hex is now matched in either case, and the URL takes the aircraft's own spelling once it is found.
