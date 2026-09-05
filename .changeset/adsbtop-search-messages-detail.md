---
'@squawk/adsbtop': minor
---

### Added

- Row cursor - `Up`/`Down` arrow keys move a highlighted selection through the aircraft table, the basis for the two features below.
- `S`earch - jump to the first tracked aircraft matching an ICAO hex, callsign, or squawk substring; `N`/`Shift+N` cycle to the next/previous match.
- `M`essages panel - a live log of new/update/lost aircraft events below the table; `V` toggles between showing only new/lost events (the default) and every update.
- `Enter`/`D`etail view - a full field dump for the selected aircraft, including barometric and geometric altitude and true/magnetic heading shown separately rather than collapsed the way the table's columns are, plus a recent altitude-history sparkline.
