# @squawk/adsb-feed

## 0.2.0

### Minor Changes

- 65a8c9b: ### Added

  - `createBeastAircraftFeed()` - a third live aircraft feed source, backed by a persistent connection to a Beast binary stream and decoded via `@squawk/beast`/`@squawk/mode-s` rather than dump1090-fa's own pre-decoded JSON/SBS output. Node-only, same as the SBS source; reconnects automatically.
  - `BeastFeedOptions.receiverPosition` - the receiving station's own position, used to resolve on-ground/surface aircraft positions (which have no pair-only CPR decode path) and to speed up a new aircraft's first airborne fix.

### Patch Changes

- Updated dependencies [65a8c9b]
  - @squawk/mode-s@0.2.0
  - @squawk/beast@0.1.1

## 0.1.0

### Minor Changes

- 91478e2: Add @squawk/adsb-feed: live ADS-B aircraft feed from a local dump1090-fa station, normalized into the shared `Aircraft` type and emitted as `aircraft:new` / `aircraft:update` / `aircraft:lost` events. Two sources: `createJsonAircraftFeed` (HTTP-polled `aircraft.json`, browser-safe) and `createSbsAircraftFeed` (persistent SBS/BaseStation socket, Node-only, lower latency).
