# @squawk/adsbtop

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/adsbtop)](https://www.npmjs.com/package/@squawk/adsbtop) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

A terminal dashboard for live ADS-B aircraft tracking, built on [`@squawk/adsb-feed`](../../packages/libs/adsb-feed). Connects to a local [dump1090-fa](https://github.com/flightaware/dump1090) station and renders tracked aircraft directly in your terminal.

## Installation

```bash
npm install -g @squawk/adsbtop
```

## Usage

```bash
adsbtop --source sbs --host 192.168.1.50
```

### Options

| Flag                | Description                                                                                 | Default                                       |
| ------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `--source <source>` | Feed to connect to: `json`, `sbs`, or `beast`                                               | `sbs`                                         |
| `--host <host>`     | dump1090-fa station hostname/IP                                                             | `localhost`                                   |
| `--port <port>`     | Port to connect to                                                                          | `8080` (json), `30003` (sbs), `30005` (beast) |
| `--url <url>`       | Full `aircraft.json` URL, overriding `--host`/`--port` (`--source json` only)               | -                                             |
| `--lat <lat>`       | Receiver latitude in decimal degrees - enables the Dist/Brg/CPA columns (requires `--lon`)  | -                                             |
| `--lon <lon>`       | Receiver longitude in decimal degrees - enables the Dist/Brg/CPA columns (requires `--lat`) | -                                             |
| `-h`, `--help`      | Show usage                                                                                  | -                                             |

### Hotkeys

| Key             | Action                                                                       |
| --------------- | ---------------------------------------------------------------------------- |
| `Up` / `Down`   | Move the row cursor                                                          |
| `O` / `Shift+O` | Cycle the sort column forward/backward (every column except `Grnd`)          |
| `R`             | Reverse the sort direction (ascending/descending)                            |
| `C`             | Toggle compact columns, for narrow terminals                                 |
| `P`             | Pause/resume the table - the feed keeps running underneath                   |
| `S`             | Search by ICAO hex, callsign, squawk, or N-number - jumps to the first match |
| `N` / `Shift+N` | Jump to the next/previous search match                                       |
| `M`             | Toggle the messages panel (recent new/update/lost events)                    |
| `V`             | Toggle messages panel verbosity (new/lost only vs. every update)             |
| `B`             | Hide/show the status bar                                                     |
| `Enter` / `D`   | Show the cursor row's full detail view                                       |
| `H`             | Toggle the help overlay                                                      |
| `Q`             | Quit                                                                         |

Aircraft render in bold red when they carry any of: an emergency squawk code (7500/7600/7700), a declared emergency state, or an active ACAS/TCAS Resolution Advisory.

### Sorting

The table sorts by ICAO hex ascending at startup. `O` and `Shift+O` step through every column except `Grnd` in display order, and `R` flips between ascending and descending while keeping the current column. The active column's header is highlighted and suffixed with `^` (ascending) or `v` (descending). Aircraft with no value for the sorted column always sink to the bottom in either direction, so unknowns never interleave with real data. `Dist`, `Brg`, and `CPA` join the sort cycle only when a receiver location is configured (see below).

### Status bar

The blue status bar above the table shows the source, host, and port; the number of tracked aircraft; the total number of feed update events received since adsbtop started (`msgs`); the current rate (`msgs/s`); and the time since the last update. `B` hides and shows it. While paused, a `PAUSED` chip (black on red) sits at the end of the bar. Note that the `PAUSED` and `RECONNECTING` chips live in the status bar, so they are hidden along with it.

### Connection status

The status bar shows a `RECONNECTING` chip (black on red) whenever the underlying feed's connection isn't currently up - a dropped SBS/Beast socket awaiting automatic reconnect, or (for `--source json`) the most recent poll having failed. Nothing is shown while connected.

### Detail view

Selecting a row and pressing `Enter` or `D` opens a full field dump for that aircraft, including barometric and geometric altitude, true track and magnetic heading, indicated/true airspeed, squawk alert/ident status, declared emergency state, active Resolution Advisory, and pilot-selected target state (altitude/heading/autopilot). Fields the active source doesn't populate show as `-`. A `Messages` row counts the feed update events received for that aircraft since it was first tracked; the count restarts if the aircraft is lost and later reappears.

#### Field population by source

Five detail-view fields have meaningfully different coverage depending on `--source` - see [`@squawk/adsb-feed`'s README](../../packages/libs/adsb-feed/README.md#field-population-by-source) for the decode details behind each:

| Field               | JSON | SBS | Beast |
| ------------------- | ---- | --- | ----- |
| Squawk alert        | -    | Yes | Yes   |
| Ident active        | -    | Yes | Yes   |
| Emergency state     | Yes  | -   | Yes   |
| Resolution advisory | -    | -   | Yes   |
| Target state        | -    | -   | Yes   |

### Messages panel

`M` toggles a live log of `aircraft:new`/`aircraft:update`/`aircraft:lost` events in a panel below the table. Defaults to showing only new/lost events, since `aircraft:update` fires far more often; `V` reveals every update too.

### Registration lookup

The `Reg` column and the detail view's `Registration` field resolve each aircraft's ICAO hex to its N-number (and make/model/operator in the detail view) using the bundled FAA registry. `S`earch also matches against the N-number. The registry loads in the background after startup - rows show `-` for a few seconds until it's ready, then populate automatically as matches are found.

### Location, distance, bearing, and closest approach

Passing both `--lat` and `--lon` (either together or not at all) configures your receiver's own position and adds three columns: `Dist` (great-circle distance in nautical miles) and `Brg` (bearing in degrees true), computed from that position to each aircraft's current position, and `CPA` (closest point of approach - see below). The detail view gets the same three fields (`Distance`/`Bearing`/`Closest approach`, shown right after `Position`), and all three columns become sortable. Without `--lat`/`--lon`, none of this appears at all - not the table columns, not the detail view rows, not the sort keys. An aircraft with no position yet shows `-` until one arrives.

`CPA` projects each aircraft's current true track and ground speed as a straight line and reports how close that line passes to your receiver and how long until the aircraft gets there, e.g. `2.1nm in 4m10s` - an aircraft that will pass directly overhead in four minutes reads `0.0nm in 4m00s`. Distance keeps one decimal under 10 nm and rounds to whole miles beyond that. Sorting on `CPA` orders by the distance at closest approach, so ascending puts the aircraft that will pass nearest you at the top. The column shows `-` for an aircraft with no position, no true track, or no ground speed, and also for one that is already opening (its closest approach is behind it), so a `-` next to a real `Dist` value means "not coming any closer".

For `--source beast`, the same location also serves as the receiver position used to decode surface (on-ground) CPR positions, which otherwise can't resolve from paired frames alone.
