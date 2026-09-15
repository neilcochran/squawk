---
'@squawk/adsbtop': minor
---

### Added

- `R` reverses the sort direction of the active column, and the highlighted header now carries a `^`/`v` suffix showing which way it is ordered.
- Every column except `Grnd` is sortable: `O` cycles forward through ICAO, callsign, registration, squawk, altitude, ground speed, heading, vertical rate, and age, plus distance and bearing when a receiver location is configured. `Shift+O` cycles backward.
- The status bar shows the total number of feed update events received since adsbtop started, next to the existing per-second rate.
- The detail view shows a `Messages` row counting the feed update events received for that aircraft since it was first tracked.
- `B` hides and shows the status bar.
- The aircraft table sits inside the same round cyan border as the detail view and help overlay.

### Changed

- The `Callsign` and `Squawk` columns are two characters wider so the sort-direction suffix fits in their headers.
- The `PAUSED` and `RECONNECTING` status-bar badges are black-on-red chips instead of yellow text, so they stand out against the blue bar instead of blending in.

### Fixed

- The selected row in the aircraft table now renders its text in black. Its cyan highlight previously left the terminal's default white text unreadable.
