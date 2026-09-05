---
'@squawk/adsbtop': minor
---

### Added

- Registration lookup - resolves each aircraft's ICAO hex to its N-number via the bundled FAA registry, shown in a new `Reg` column and the detail view's `Registration` field (with make/model/operator). `S`earch now also matches the N-number.
- Ground speed as a sortable column (`O`), alongside ICAO hex, callsign, altitude, and age.

### Fixed

- The `M`essages panel's default view (new/lost events only) could lose a still-relevant entry after switching to the verbose (all events) view and back, since both views filtered one shared, capped log and high-frequency update events could evict the entry from that shared cap. New/lost events now get their own independently-capped log, so verbose-view traffic can no longer push them out.
