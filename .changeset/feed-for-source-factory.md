---
'@squawk/adsb-feed': minor
'@squawk/adsbtop': minor
---

**@squawk/adsb-feed**

### Added

- `createAircraftFeedForSource()` creates a feed for a source chosen at runtime (`'json' | 'sbs' | 'beast'`, e.g. from a CLI flag or config value), dispatching to the matching factory so callers need one call site instead of a switch. `port` defaults per source, the `json` endpoint is assembled from `host`/`port` unless `url` is given, and options that do not apply to the selected source are ignored. Node-only, like the SBS and Beast sources.
- `FeedSource` type and `DEFAULT_PORT_BY_SOURCE` (dump1090-fa's default port for each source: `8080` json, `30003` sbs, `30005` beast).

**@squawk/adsbtop**

### Changed

- `--source` now defaults to `beast` instead of `sbs`. adsbtop decodes the raw Mode-S/ADS-B messages itself on that source, so category, emergency state, Resolution Advisories, and target state populate without passing a flag. Pass `--source sbs` to keep the previous behaviour. With the Beast source, `--lat`/`--lon` are also what lets aircraft on the ground resolve a position.

### Fixed

- An IPv6 literal `--host` with `--source json` now produces a valid `aircraft.json` URL.
