---
'@squawk/adsb-feed': minor
---

### Added

- `createBeastAircraftFeed()` - a third live aircraft feed source, backed by a persistent connection to a Beast binary stream and decoded via `@squawk/beast`/`@squawk/mode-s` rather than dump1090-fa's own pre-decoded JSON/SBS output. Node-only, same as the SBS source; reconnects automatically.
- `BeastFeedOptions.receiverPosition` - the receiving station's own position, used to resolve on-ground/surface aircraft positions (which have no pair-only CPR decode path) and to speed up a new aircraft's first airborne fix.
