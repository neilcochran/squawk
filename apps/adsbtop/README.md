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

| Flag                | Description                                                                             | Default                                       |
| ------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| `--source <source>` | Feed to connect to: `json`, `sbs`, or `beast`                                           | `sbs`                                         |
| `--host <host>`     | dump1090-fa station hostname/IP                                                         | `localhost`                                   |
| `--port <port>`     | Port to connect to                                                                      | `8080` (json), `30003` (sbs), `30005` (beast) |
| `--url <url>`       | Full `aircraft.json` URL, overriding `--host`/`--port` (`--source json` only)           | -                                             |
| `--lat <lat>`       | Receiver latitude in decimal degrees - enables the Dist/Brg columns (requires `--lon`)  | -                                             |
| `--lon <lon>`       | Receiver longitude in decimal degrees - enables the Dist/Brg columns (requires `--lat`) | -                                             |
| `-h`, `--help`      | Show usage                                                                              | -                                             |

### Hotkeys

| Key             | Action                                                                       |
| --------------- | ---------------------------------------------------------------------------- |
| `Up` / `Down`   | Move the row cursor                                                          |
| `O`             | Cycle the sort column (ICAO, callsign, altitude, ground speed, age)          |
| `C`             | Toggle compact columns, for narrow terminals                                 |
| `P`             | Pause/resume the table - the feed keeps running underneath                   |
| `S`             | Search by ICAO hex, callsign, squawk, or N-number - jumps to the first match |
| `N` / `Shift+N` | Jump to the next/previous search match                                       |
| `M`             | Toggle the messages panel (recent new/update/lost events)                    |
| `V`             | Toggle messages panel verbosity (new/lost only vs. every update)             |
| `Enter` / `D`   | Show the cursor row's full detail view                                       |
| `H`             | Toggle the help overlay                                                      |
| `Q`             | Quit                                                                         |

Aircraft render in bold red when they carry any of: an emergency squawk code (7500/7600/7700), a declared emergency state, or an active ACAS/TCAS Resolution Advisory.

### Detail view

Selecting a row and pressing `Enter` or `D` opens a full field dump for that aircraft, including barometric and geometric altitude, true track and magnetic heading, indicated/true airspeed, squawk alert/ident status, declared emergency state, active Resolution Advisory, and pilot-selected target state (altitude/heading/autopilot). Fields the active source doesn't populate show as `-`.

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

### Location, distance, and bearing

Passing both `--lat` and `--lon` (either together or not at all) configures your receiver's own position and adds two columns: `Dist` (great-circle distance in nautical miles) and `Brg` (bearing in degrees true), computed from that position to each aircraft's current position. The detail view gets the same two fields (`Distance`/`Bearing`, shown right after `Position`). Without `--lat`/`--lon`, none of this appears at all - not the table columns, not the detail view rows. An aircraft with no position yet shows `-` until one arrives.

For `--source beast`, the same location also serves as the receiver position used to decode surface (on-ground) CPR positions, which otherwise can't resolve from paired frames alone.
