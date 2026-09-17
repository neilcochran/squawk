---
'@squawk/adsbtop': minor
'@squawk/adsb-feed': minor
---

**@squawk/adsbtop**

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
