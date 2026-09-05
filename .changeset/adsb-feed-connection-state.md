---
'@squawk/adsb-feed': minor
---

### Added

- `AircraftFeed.getConnectionState()` and `connection:connect`/`connection:disconnect` events, reporting `'connected' | 'reconnecting'` for all three sources. SBS and Beast reflect their own TCP socket's connect/close lifecycle (Beast forwards `@squawk/beast`'s own `beast:connect`/`beast:disconnect`); JSON uses the most recent poll's success/failure instead, since HTTP polling has no persistent connection to track.
