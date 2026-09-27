# @squawk/adsb-feed

## 0.8.0

### Minor Changes

- a0f2ee1: **@squawk/mode-s**

  ### Added
  - Airborne position messages now carry `surveillanceStatus`, decoded from their Surveillance Status field: `none`, `permanentAlert` (an emergency squawk), `temporaryAlert` (a recent change to any other squawk), or `ident`. Position messages are broadcast twice a second whether or not the aircraft is being interrogated, so they report an alert or an ident far more often than the Flight Status of a DF4/5/20/21 reply. It is undefined for surface positions, which have no such field.
  - `decodeSurveillanceStatus()` and the `SurveillanceStatus` type, for callers decoding a raw ME field themselves.

  **@squawk/adsb-feed**

  ### Changed
  - The Beast source now updates `identActive` and `squawkAlert` from airborne position messages as well as from Mode-S surveillance replies, reading the Surveillance Status the way dump1090-fa does. Both flags now follow the transponder for any aircraft broadcasting its position, not only while a radar is interrogating it, and an ident or alert that has ended clears within a second or so instead of lingering until the next reply.

  ### Fixed
  - The SBS source now reads the BaseStation alert, SPI, and on-ground flags as dump1090-fa writes them, where `-1` means true. It accepted only `1` before, so on an SBS feed `onGround`, `squawkAlert`, and `identActive` were never true: an aircraft on the ground kept its last airborne state, and ident and squawk-change alerts never registered. `1` is still read as true.

  **@squawk/adsbtop**

  ### Changed
  - With `--source beast`, the detail view's `Squawk alert` and `Ident active` rows now follow the aircraft's position broadcasts, so they turn on and off within a second or so of the transponder rather than waiting for its next interrogation reply.

  ### Fixed
  - With `--source sbs`, an aircraft on the ground now shows `GND` in the `Grnd` column and matches `is:ground` rather than `is:airborne`, and the detail view's `Squawk alert` and `Ident active` rows show `Yes` when set.

  **@squawk/adsbscope**

  ### Fixed
  - With `--source sbs`, an aircraft on the ground is now shown as on the ground - `GND` for altitude, and in the digital view style a hollow symbol with no velocity vector - instead of keeping its last airborne altitude.

### Patch Changes

- Updated dependencies [a0f2ee1]
  - @squawk/mode-s@0.4.0
  - @squawk/beast@0.1.3

## 0.7.0

### Minor Changes

- 49fb0fb: ### Added

  - `isEmergencyAircraft()` reports whether an `Aircraft` is in an emergency: an emergency squawk, a declared emergency state, or an active ACAS/TCAS Resolution Advisory. Any one is sufficient, since which of them a feed can see depends on its source. It is built from `isEmergencySquawk()` (7500, 7600, or 7700, also exported as the `EMERGENCY_SQUAWKS` set) and `isDeclaredEmergencyState()` (any `EmergencyState` other than `'none'` and `'reserved'`), which are exported too. All are pure and available from the browser entry point as well.

## 0.6.0

### Minor Changes

- 2948e75: **@squawk/adsb-feed**

  ### Added
  - `createAircraftFeedForSource()` creates a feed for a source chosen at runtime (`'json' | 'sbs' | 'beast'`, e.g. from a CLI flag or config value), dispatching to the matching factory so callers need one call site instead of a switch. `port` defaults per source, the `json` endpoint is assembled from `host`/`port` unless `url` is given, and options that do not apply to the selected source are ignored. Node-only, like the SBS and Beast sources.
  - `FeedSource` type and `DEFAULT_PORT_BY_SOURCE` (dump1090-fa's default port for each source: `8080` json, `30003` sbs, `30005` beast).

  **@squawk/adsbtop**

  ### Changed
  - `--source` now defaults to `beast` instead of `sbs`. adsbtop decodes the raw Mode-S/ADS-B messages itself on that source, so category, emergency state, Resolution Advisories, and target state populate without passing a flag. Pass `--source sbs` to keep the previous behaviour. With the Beast source, `--lat`/`--lon` are also what lets aircraft on the ground resolve a position.

  ### Fixed
  - An IPv6 literal `--host` with `--source json` now produces a valid `aircraft.json` URL.

## 0.5.0

### Minor Changes

- 8acd4b2: **@squawk/adsbtop**

  ### Added
  - `CPA` column and `Closest approach` detail row: each aircraft's true track and ground speed are projected to report how close it will pass the receiver and when, e.g. `2.1nm in 4m10s`. Aircraft with no track or speed, or already opening, show `-`.
  - Columns are chosen per session: auto-fit to the terminal width by default (dropping the least valuable columns first and never `ICAO`), `--columns <list>` for an explicit set, and a `C` column picker listing every column with its short header and full name. Columns the session cannot populate (`Dist`/`Brg`/`CPA` without `--lat`/`--lon`, `Cat` with the SBS source) are left out of the table and shown dimmed in the picker with the reason.
  - `F` filter prompt and `-f`/`--filter` flag: `is:airborne`, `is:ground`, `is:emergency`, `within:<distance>`, `alt:>N`/`alt:<N`/`alt:N-M`, and free text matched like search, all combinable. The status bar shows `matching/total` and the filter text, and `Escape` clears it.
  - `--watch <list>` highlights aircraft by ICAO hex, N-number, or callsign prefix in bold yellow and rings the terminal bell when one appears or is lost; `--alert-emergency` rings when an aircraft first becomes an emergency; `--no-bell` silences both. The status bar counts watched aircraft, including any the filter is hiding.
  - `Cat` column and spelled-out `Category` detail row for the ADS-B emitter category, sortable in weight-class order.
  - Newly tracked aircraft render green for three seconds, and aircraft with no update for half the stale threshold dim before they drop. `--stale-after <ms>` sets that threshold.
  - `T` session stats panel: uptime, current/peak/unique aircraft counts, message totals with the last minute's average and peak, a sparkline of that minute's rates, and, with a location, the farthest aircraft seen.
  - `W` writes the table as shown to a timestamped CSV in the working directory, and `--record <file>` appends every feed event as one JSON object per line. Outcomes and failures appear as chips in the status bar.
  - `U` toggles between aviation and metric units across the table, detail view, stats, and snapshots; `--units metric` starts that way. Filter distances and altitudes follow the active units unless given an explicit suffix.
  - The table and detail view render only the rows that fit the terminal, with a `rows 12-40 of 118` footer, a window that follows the cursor, `PgUp`/`PgDn` and `Home`/`End`, and `Left`/`Right` to step between aircraft inside the detail view. adsbtop now runs on the terminal's alternate screen, leaving the shell's scrollback untouched.

  ### Changed
  - `C` opens the column picker instead of toggling a compact layout; the picker's `M` selects the equivalent minimal set.
  - Status-bar chips (`RECONNECTING`, `PAUSED`, and the new notices) sit on the bar's second line, so a wrapped summary can no longer collide with them or clip the `adsbtop` label.
  - The hotkey bar wraps onto a second line in narrow terminals instead of truncating its labels.
  - The `GS` column is two characters wider so metric speeds fit.
  - Position history retained per aircraft is capped at 300 samples; it previously grew for the whole session.

  ### Fixed
  - Aircraft now drop within a second of `--stale-after` elapsing rather than up to five seconds late, via the feed change below.

  **@squawk/adsb-feed**

  ### Added
  - `sweepIntervalMs` option on all three feed factories, controlling how often the staleness sweep runs.

  ### Changed
  - The staleness sweep runs every second by default instead of every five, so `aircraft:lost` fires within a second of `staleAfterMs` elapsing. A sweep is one pass over the tracked aircraft, so the cost is negligible; pass a longer `sweepIntervalMs` to sweep less often.

## 0.4.0

### Minor Changes

- 346a92d: ### Added

  - `AircraftFeed.getConnectionState()` and `connection:connect`/`connection:disconnect` events, reporting `'connected' | 'reconnecting'` for all three sources. SBS and Beast reflect their own TCP socket's connect/close lifecycle (Beast forwards `@squawk/beast`'s own `beast:connect`/`beast:disconnect`); JSON uses the most recent poll's success/failure instead, since HTTP polling has no persistent connection to track.

## 0.3.0

### Minor Changes

- 9015223: ### Added

  - The JSON source populates `Aircraft.emergencyState` from `aircraft.json`'s `emergency` field.
  - The SBS source populates `Aircraft.identActive`/`squawkAlert` from the BaseStation `SPI`/`Alert` fields.
  - The Beast source populates `Aircraft.emergencyState`, `identActive`, `squawkAlert`, `resolutionAdvisory` (from either a DF16 reply or an ADS-B broadcast), and `targetState` - all previously decoded by `@squawk/mode-s` but discarded by the mapper.

### Patch Changes

- Updated dependencies [9015223]
- Updated dependencies [9015223]
  - @squawk/mode-s@0.3.0
  - @squawk/types@0.9.0
  - @squawk/beast@0.1.2

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
