# @squawk/adsbtop

## 0.6.1

### Patch Changes

- e53f8d9: ### Fixed

  - Memory no longer grows for the whole session. adsbtop ran React's development build, which records a `performance.measure()` entry on every render that Node never evicts, so after roughly ten minutes on a busy feed Node printed a `MaxPerformanceEntryBufferExceededWarning` over the display. adsbtop now defaults `NODE_ENV` to `production` before React loads, which also makes each render cheaper. An explicitly set `NODE_ENV` is left untouched.

## 0.6.0

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

### Patch Changes

- Updated dependencies [8acd4b2]
  - @squawk/adsb-feed@0.5.0

## 0.5.0

### Minor Changes

- f48361c: ### Added

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

## 0.4.1

### Patch Changes

- b52de9f: ### Fixed

  - The published tarball now contains the compiled `dist/` output. 0.4.0 shipped with only `package.json` and `README.md`, leaving the package installable but with no runnable code and no working `adsbtop` command.
  - Test helpers are no longer included in the published package.

## 0.4.0

### Minor Changes

- 6ca0808: ### Added

  - The status header shows a `RECONNECTING` indicator whenever the underlying feed's connection isn't currently up, using `@squawk/adsb-feed`'s new connection-state surface.

### Patch Changes

- Updated dependencies [346a92d]
  - @squawk/adsb-feed@0.4.0

## 0.3.0

### Minor Changes

- f750c8c: ### Added

  - Detail view: five new rows for the phase-5 decoded fields - `Squawk alert`, `Ident active`, `Emergency state`, `Resolution advisory`, and `Target state` (selected altitude/heading and autopilot status).
  - README "Field population by source" table showing which of JSON/SBS/Beast populate those five fields; the `--help` usage text and the `H`elp overlay both note the same coverage difference.

  ### Changed
  - Aircraft squawking an emergency code, declaring an emergency state, or carrying an active ACAS/TCAS Resolution Advisory all render their row in bold red - previously only the emergency squawk code triggered this.

## 0.2.1

### Patch Changes

- Updated dependencies [9015223]
- Updated dependencies [9015223]
  - @squawk/adsb-feed@0.3.0
  - @squawk/types@0.9.0
  - @squawk/geo@0.4.10
  - @squawk/icao-registry@0.5.8
  - @squawk/icao-registry-data@0.8.12

## 0.2.0

### Minor Changes

- c0acfca: ### Added

  - Terminal dashboard for live ADS-B aircraft tracking, connecting to a local dump1090-fa station over its JSON, SBS, or Beast output (`--source`, `--host`, `--port`/`--url`).
  - A live-updating aircraft table - ICAO hex, callsign, N-number (resolved via the bundled FAA registry), squawk, altitude, ground speed, heading, vertical rate, on-ground indicator, and age since last seen - sortable by ICAO hex, callsign, altitude, ground speed, or age (`O`), with a compact column mode for narrow terminals (`C`). Aircraft squawking an emergency code (7500/7600/7700) render in bold red.
  - A row cursor (arrow keys) and a detail view (`Enter`/`D`) showing every field for the selected aircraft.
  - Search (`S`) by ICAO hex, callsign, squawk, or N-number, with `N`/`Shift+N` to cycle matches.
  - A live messages panel (`M`) logging new/update/lost feed events, with a verbosity toggle (`V`) between new/lost only and every update.
  - `P`ause, a help overlay (`H`), and a status header showing connection info and message rate.
  - An optional receiver location (`--lat`/`--lon`) adds Dist/Brg table columns and matching detail-view fields, showing distance and bearing from that point to each tracked aircraft; for `--source beast`, the same location also improves on-ground position decoding.
