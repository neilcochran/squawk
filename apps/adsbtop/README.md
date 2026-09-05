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

| Flag                | Description                                                                   | Default                                       |
| ------------------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| `--source <source>` | Feed to connect to: `json`, `sbs`, or `beast`                                 | `sbs`                                         |
| `--host <host>`     | dump1090-fa station hostname/IP                                               | `localhost`                                   |
| `--port <port>`     | Port to connect to                                                            | `8080` (json), `30003` (sbs), `30005` (beast) |
| `--url <url>`       | Full `aircraft.json` URL, overriding `--host`/`--port` (`--source json` only) | -                                             |
| `-h`, `--help`      | Show usage                                                                    | -                                             |

### Hotkeys

| Key             | Action                                                             |
| --------------- | ------------------------------------------------------------------ |
| `Up` / `Down`   | Move the row cursor                                                |
| `O`             | Cycle the sort column (ICAO, callsign, altitude, age)              |
| `C`             | Toggle compact columns, for narrow terminals                       |
| `P`             | Pause/resume the table - the feed keeps running underneath         |
| `S`             | Search by ICAO hex, callsign, or squawk - jumps to the first match |
| `N` / `Shift+N` | Jump to the next/previous search match                             |
| `M`             | Toggle the messages panel (recent new/update/lost events)          |
| `V`             | Toggle messages panel verbosity (new/lost only vs. every update)   |
| `Enter` / `D`   | Show the cursor row's full detail view                             |
| `H`             | Toggle the help overlay                                            |
| `Q`             | Quit                                                               |

Aircraft squawking an emergency code (7500/7600/7700) render in bold red.

### Detail view

Selecting a row and pressing `Enter` or `D` opens a full field dump for that aircraft, including barometric and geometric altitude, true track and magnetic heading, indicated/true airspeed, and an altitude-history sparkline. Fields the active source doesn't populate show as `-`.

### Messages panel

`M` toggles a live log of `aircraft:new`/`aircraft:update`/`aircraft:lost` events in a panel below the table. Defaults to showing only new/lost events, since `aircraft:update` fires far more often; `V` reveals every update too.
