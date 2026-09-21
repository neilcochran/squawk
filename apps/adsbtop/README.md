# @squawk/adsbtop

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/adsbtop)](https://www.npmjs.com/package/@squawk/adsbtop) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

A terminal dashboard for live ADS-B aircraft tracking, built on [`@squawk/adsb-feed`](../../packages/libs/adsb-feed). Connects to a local [dump1090-fa](https://github.com/flightaware/dump1090) station and renders tracked aircraft directly in your terminal.

## Installation

```bash
npm install -g @squawk/adsbtop
```

## Usage

```bash
adsbtop --host 192.168.1.50 --lat 40.6413 --lon -73.7781
```

With no `--source`, adsbtop connects to the station's raw Beast output and decodes the Mode-S/ADS-B messages itself, which populates the most fields (see [Field population by source](#field-population-by-source)). `--lat`/`--lon` are optional, but with the Beast source they are also what lets aircraft on the ground resolve a position (see [Location](#location-distance-bearing-and-closest-approach)).

### Options

| Flag                    | Description                                                                                                                                        | Default                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `--source <source>`     | Feed to connect to: `json`, `sbs`, or `beast`                                                                                                      | `beast`                                       |
| `--host <host>`         | dump1090-fa station hostname/IP                                                                                                                    | `localhost`                                   |
| `--port <port>`         | Port to connect to                                                                                                                                 | `8080` (json), `30003` (sbs), `30005` (beast) |
| `--url <url>`           | Full `aircraft.json` URL, overriding `--host`/`--port` (`--source json` only)                                                                      | -                                             |
| `--lat <lat>`           | Receiver latitude in decimal degrees - enables the Dist/Brg/CPA columns (requires `--lon`)                                                         | -                                             |
| `--lon <lon>`           | Receiver longitude in decimal degrees - enables the Dist/Brg/CPA columns (requires `--lat`)                                                        | -                                             |
| `--columns <list>`      | Comma-separated columns to show, by header name (e.g. `icao,callsign,alt,dist`) - see [Columns](#columns)                                          | auto-fit to the terminal width                |
| `-f`, `--filter <text>` | Start with this filter applied, same syntax as the `F` prompt (e.g. `"is:air within:25"`) - see [Filtering](#filtering)                            | -                                             |
| `--watch <list>`        | Comma-separated ICAO hexes, N-numbers, or callsign prefixes to highlight and ring the bell for - see [Watchlist and alerts](#watchlist-and-alerts) | -                                             |
| `--alert-emergency`     | Ring the bell when an aircraft first squawks or declares an emergency                                                                              | off                                           |
| `--no-bell`             | Never ring the terminal bell; watchlist and emergency highlighting still apply                                                                     | bell on                                       |
| `--stale-after <ms>`    | Drop an aircraft after this long without an update; rows dim at half this - see [Row styling](#row-styling)                                        | `60000`                                       |
| `--record <file>`       | Append every new/update/lost feed event to the file as one JSON object per line - see [Snapshot and record](#snapshot-and-record)                  | -                                             |
| `--units <system>`      | Unit system to start in, `aviation` or `metric` - see [Units](#units)                                                                              | `aviation`                                    |
| `-h`, `--help`          | Show usage                                                                                                                                         | -                                             |

### Hotkeys

| Key              | Action                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `Up` / `Down`    | Move the row cursor (in the detail view: scroll the fields)                                     |
| `PgUp` / `PgDn`  | Move the cursor, or scroll the detail view, a page at a time                                    |
| `Home` / `End`   | Jump to the first/last row, or line of the detail view                                          |
| `Left` / `Right` | In the detail view: show the previous/next aircraft                                             |
| `O` / `Shift+O`  | Cycle the sort column forward/backward (every column except `Grnd`)                             |
| `R`              | Reverse the sort direction (ascending/descending)                                               |
| `C`              | Open the column picker - choose which columns are shown                                         |
| `P`              | Pause/resume the table - the feed keeps running underneath                                      |
| `S`              | Search by ICAO hex, callsign, squawk, or N-number - jumps to the first match                    |
| `N` / `Shift+N`  | Jump to the next/previous search match                                                          |
| `F`              | Filter the table (see [Filtering](#filtering)) - `Escape` on the table clears an active filter  |
| `M`              | Toggle the messages panel (recent new/update/lost events)                                       |
| `V`              | Toggle messages panel verbosity (new/lost only vs. every update)                                |
| `T`              | Toggle the session stats panel (see [Session stats](#session-stats))                            |
| `B`              | Hide/show the status bar                                                                        |
| `W`              | Write the table as shown to a timestamped CSV (see [Snapshot and record](#snapshot-and-record)) |
| `U`              | Toggle units between aviation and metric (see [Units](#units))                                  |
| `Enter` / `D`    | Show the cursor row's full detail view                                                          |
| `H`              | Toggle the help overlay                                                                         |
| `Q`              | Quit                                                                                            |

Rows are styled by state - see [Row styling](#row-styling).

### Row styling

Each row's text reflects the aircraft's state, by precedence:

| State      | Style         | Meaning                                                                                                                                                               |
| ---------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Emergency  | bold red      | An emergency squawk (7500/7600/7700), a declared emergency state, or an active ACAS/TCAS Resolution Advisory - beats every other style                                |
| Cursor row | black on cyan | The row `Up`/`Down` selects; bold when the aircraft is also watched                                                                                                   |
| Watched    | bold yellow   | On the `--watch` list - see [Watchlist and alerts](#watchlist-and-alerts)                                                                                             |
| New        | green         | First tracked within the last 3 seconds, so arrivals catch the eye without the messages panel open; an aircraft that is lost and reappears is new again               |
| Stale      | dimmed        | No update for half the stale threshold (see below) - the row will drop off the table if nothing arrives; applied on top of the other styles, except on the cursor row |

`--stale-after <ms>` sets the stale threshold: how long an aircraft may go without any update before the feed drops it (default `60000`, one minute). Rows dim at half that, so with the default a row that has been quiet for 30 seconds dims and is dropped at 60, within about a second of the threshold. Lower it on a busy receiver to clear departed traffic sooner, or raise it on a quiet one where legitimate gaps between updates are long.

### Sorting

The table sorts by ICAO hex ascending at startup. `O` and `Shift+O` step through every visible column except `Grnd` in display order, and `R` flips between ascending and descending while keeping the current column. The active column's header is highlighted and suffixed with `^` (ascending) or `v` (descending). Aircraft with no value for the sorted column always sink to the bottom in either direction, so unknowns never interleave with real data. `Dist`, `Brg`, and `CPA` join the sort cycle only when a receiver location is configured and they are shown (see [Columns](#columns) and [Location](#location-distance-bearing-and-closest-approach) below). Hiding the column currently sorted on resets the sort to the first visible column.

### Columns

Which columns render is decided in one of two ways:

- **Auto-fit (the default).** With nothing configured, adsbtop reads the terminal width and drops columns until the table fits, so a narrow window shows a sensible subset instead of truncated cells. Columns are dropped least valuable first: `Grnd`, `Cat`, `Reg`, `VS`, `Brg`, `Hdg`, `CPA`, `GS`, `Dist`, `Age`, `Squawk`, `Alt`, `Callsign`. `ICAO` is never dropped. Auto-fit follows the window as you resize it.
- **An explicit set.** `--columns <list>` takes comma-separated column names as they appear in the header, case-insensitive: `--columns icao,callsign,alt,dist,cpa`. Order does not matter - columns always render in their usual display order. An unknown or duplicated name is an error listing the valid names, and `Dist`/`Brg`/`CPA` are an error without `--lat`/`--lon`. Passing `--columns` turns auto-fit off.

`C` opens the column picker once running. It lists every available column with a checkbox, showing both the short header and the full name (`Brg` / `Bearing from receiver`, `CPA` / `Closest point of approach`) so the abbreviations are never ambiguous, plus how wide the current table is against the terminal. `Up`/`Down` move the cursor, `Space` toggles the column under it, `A` selects every column, `M` selects the minimal set (`ICAO`, `Callsign`, `Squawk`, `Alt`, `Age`), `F` returns to auto-fit, and `Escape`, `Enter`, or `C` closes the picker. Toggling any column switches from auto-fit to an explicit set seeded from what was showing, and at least one column always stays selected. Columns the session cannot populate - `Dist`/`Brg`/`CPA` without `--lat`/`--lon`, and `Cat` with `--source sbs` - are left out of the table and the sort cycle entirely, and the picker lists them dimmed with the reason (`needs --lat/--lon`, `is not sent by sbs`) so they cannot be selected. Asking for one with `--columns` is a startup error for the same reason. The picker's choices last for the session only - use `--columns` for a persistent preference.

### Category

The `Cat` column shows the aircraft's ADS-B emitter category as a three-letter code: `LGT` light, `SML` small, `LRG` large, `HVL` high-vortex large, `HVY` heavy, `HPF` high performance, `ROT` rotorcraft, `GLD` glider, `LTA` lighter than air, `PAR` parachutist, `ULT` ultralight, `UAV` unmanned, `SPC` space vehicle, `SEV`/`SSV` surface emergency/service vehicle, and `OBS`/`OBC`/`OBL` point/cluster/line obstacle. The detail view's `Category` row spells it out with the weight class where the standard defines one, e.g. `Large (75,000 to 300,000 lb)`. Sorting on `Cat` follows the emitter-category table order, so the weight classes ascend from light to heavy rather than sorting by name. An aircraft that reports "no category information" shows `-`, exactly like one that has not reported a category at all, and sorts to the bottom with it; the detail view tells the two apart. The SBS/BaseStation format carries no category at all, so with `--source sbs` the column is unavailable: it is left out of the table, the picker lists it dimmed as `is not sent by sbs`, and `--columns cat` is a startup error. Use `json` or `beast` to see it (see [Field population by source](#field-population-by-source)).

### Status bar

The blue status bar above the table shows the source, host, and port; the number of tracked aircraft (as `matching/total` followed by the filter text while a filter is active - see [Filtering](#filtering)); the number of watched aircraft when `--watch` is set, with how many the filter is hiding (see [Watchlist and alerts](#watchlist-and-alerts)); the total number of feed update events received since adsbtop started (`msgs`); the current rate (`msgs/s`); and the time since the last update. `B` hides and shows it. While paused, a `PAUSED` chip (black on red) appears on the bar's second line, which also carries the `RECONNECTING` chip and the `saved`/failure notices from [Snapshot and record](#snapshot-and-record). Note that all of these live in the status bar, so they are hidden along with it.

### Filtering

`F` opens a filter prompt. The table then shows only aircraft matching every whitespace-separated term, and the status bar reads `aircraft: 12/40  |  filter: ...` so a narrowed table is never mistaken for a quiet sky. Terms are:

| Term                           | Keeps                                                                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `is:airborne` (or `is:air`)    | Aircraft not reporting on-ground, including those with no on-ground flag at all                                                                                                                                                                                                |
| `is:ground` (or `is:gnd`)      | Aircraft reporting on-ground                                                                                                                                                                                                                                                   |
| `is:emergency` (or `is:emerg`) | Aircraft rendering as an emergency row: an emergency squawk, a declared emergency state, or an active Resolution Advisory                                                                                                                                                      |
| `within:<distance>`            | Aircraft within that distance of the receiver, read in the active units (nautical miles, or kilometres under metric) unless it carries an explicit `nm` or `km` suffix - needs `--lat`/`--lon`, and aircraft with no position are excluded                                     |
| `alt:>N`, `alt:<N`, `alt:N-M`  | Aircraft above, below, or inside (inclusive) an altitude, read in the active units (feet, or metres under metric) unless it carries an explicit `ft` or `m` suffix; `>` and `<` are strict, several `alt:` terms narrow each other, and aircraft with no altitude are excluded |
| anything else                  | Aircraft whose ICAO hex, callsign, squawk, or N-number contains the text - the same match `S`earch uses                                                                                                                                                                        |

For example, `is:air within:25 UAL` keeps airborne United aircraft inside 25 nm (or 25 km under metric units - see [Units](#units)), and `alt:<10000 within:30` keeps the low traffic near you. The prompt opens pre-filled with the current filter so it can be edited: `Enter` applies it, submitting an empty prompt clears it, and `Escape` cancels the edit and keeps whatever filter was already active. A term that cannot be parsed (an unknown qualifier, `is:airborne` together with `is:ground`, or `within:` without a location) keeps the prompt open with the reason shown under it. Once a filter is active, `Escape` on the table clears it, and the hotkey bar's `[F]` reads `Edit filter`.

To start already filtered, pass `-f`/`--filter <text>` with the same syntax; it is validated at startup and a bad term exits with the message the prompt would have shown. Once running, `F` and `Escape` edit or clear it like any other filter.

The cursor, `S`earch, `N`ext match, and the detail view all work on the filtered rows, and applying a filter that hides the cursor row moves the cursor to the first match. An aircraft whose state changes so it no longer matches (say it lands under `is:airborne`) drops out of the table on its next update. The filter lasts for the session only.

### Watchlist and alerts

`--watch <list>` takes comma-separated terms, each an ICAO hex, an N-number, or a callsign prefix: `--watch a0b1c2,N12345,UAL`. A term never has to say which kind it is - it matches an aircraft whose hex or resolved N-number equals it, or whose callsign starts with it, ignoring case. Matching rows render in bold yellow, and the status bar gains a `watch: 2` segment counting the tracked aircraft that match.

The terminal bell rings once when a watched aircraft first appears and once when it is lost. Because N-numbers resolve from the bundled registry a few seconds after startup, a watch by N-number rings when the registration resolves rather than when the aircraft first shows up. `--alert-emergency` additionally rings when any aircraft first becomes an emergency row (an emergency squawk, a declared emergency state, or an active Resolution Advisory), watched or not. Several alerts landing in the same update ring once.

Alerts and the filter are deliberately independent: the bell reports what is tracked, not what is shown, so a watched aircraft that an active filter hides still rings, and the status bar reads `watch: 2 (1 hidden)` so you know to widen the filter. The bell is suppressed while the table is paused, and `--no-bell` silences it for the whole session while keeping the highlighting - useful in a shared terminal.

### Connection status

The status bar shows a `RECONNECTING` chip (black on red) whenever the underlying feed's connection isn't currently up - a dropped SBS/Beast socket awaiting automatic reconnect, or (for `--source json`) the most recent poll having failed. Nothing is shown while connected.

### Fitting the terminal

adsbtop never draws more rows than the terminal has. The table and the detail view render only the rows that fit after the status bar, hotkey bar, any open prompt, and any open messages or stats panel, and a dim footer such as `rows 12-40 of 118` says what is hidden. The table's window follows the cursor, so `Up`/`Down` scroll it once the cursor reaches an edge, `PgUp`/`PgDn` move a page at a time, and `Home`/`End` jump to the ends. In the detail view the same keys scroll the field list instead, and `Left`/`Right` step to the previous or next aircraft without leaving it. Resizing the terminal re-fits both immediately.

This is why the terminal's own scrollbar is no use with a live TUI: the whole screen is redrawn every update, so anything scrolled out of view is redrawn back. adsbtop also runs on the terminal's alternate screen, like `top` or `less`, so it leaves no trail in your scrollback and restores what was there when it exits.

### Detail view

Selecting a row and pressing `Enter` or `D` opens a full field dump for that aircraft, including barometric and geometric altitude, true track and magnetic heading, indicated/true airspeed, squawk alert/ident status, declared emergency state, active Resolution Advisory, and pilot-selected target state (altitude/heading/autopilot). Fields the active source doesn't populate show as `-`. A `Messages` row counts the feed update events received for that aircraft since it was first tracked; the count restarts if the aircraft is lost and later reappears.

#### Field population by source

Six fields have meaningfully different coverage depending on `--source` - see [`@squawk/adsb-feed`'s README](../../packages/libs/adsb-feed/README.md#field-population-by-source) for the decode details behind each:

| Field               | JSON | SBS | Beast |
| ------------------- | ---- | --- | ----- |
| Category            | Yes  | -   | Yes   |
| Squawk alert        | -    | Yes | Yes   |
| Ident active        | -    | Yes | Yes   |
| Emergency state     | Yes  | -   | Yes   |
| Resolution advisory | -    | -   | Yes   |
| Target state        | -    | -   | Yes   |

### Units

adsbtop renders in aviation units by default: feet, knots, nautical miles, and feet per minute, as broadcast. `U` switches every altitude, speed, distance, and vertical rate in the table, the detail view, the stats panel, and snapshots to metric - metres, km/h, kilometres, and metres per second - and back; the hotkey bar's `[U]` names the system pressing it switches to. `--units metric` starts that way. Bearings and headings are degrees either way. The `Filter` prompt's hint and bare `within:` and `alt:` values follow the active system - `within:25` is 25 nm in aviation units and 25 km in metric, `alt:>5000` is 5,000 ft or 5,000 m - and an explicit `nm`/`km` or `ft`/`m` suffix always wins; a filter keeps the distance it was applied with if you toggle units afterwards. The choice lasts for the session only.

### Session stats

`T` toggles a panel below the table summarizing the session so far:

- uptime, and the aircraft count now, at its peak, and the number of distinct ICAO hexes seen since start (including aircraft since lost);
- the total message count, the current rate, and the average and peak rate over the last minute, followed by a one-line sparkline of that minute's per-second rates - a quick read on whether the receiver is healthy and how busy the sky is;
- with `--lat`/`--lon`, the farthest aircraft seen and which one it was, as a rough measure of the receiver's range.

The figures accumulate from the feed events adsbtop already receives, so the panel costs nothing while hidden and is never reset until adsbtop exits.

The sparkline is drawn with the Unicode block characters U+2581 to U+2588. Terminals that do not fall back to another font for missing glyphs, such as PuTTY with its default Courier New, show most of the bars as hollow boxes; switching the terminal to a font that includes them (Cascadia Mono, DejaVu Sans Mono, Consolas) fixes it.

### Snapshot and record

`W` writes the table exactly as it is shown - the visible columns, in the current sort order, after any active filter - to `adsbtop-YYYYMMDD-HHMMSS.csv` in the working directory, and confirms with a green `saved ...` chip in the status bar for a few seconds. Cells are written as rendered, units and `-` placeholders included, so the file is a faithful copy of the screen rather than a raw export. A failed write shows a red chip with the reason instead.

`--record <file>` appends every `aircraft:new`, `aircraft:update`, and `aircraft:lost` event to the file as one JSON object per line for the whole session: `{"type":"update","at":1758000000000,"aircraft":{...}}`, with `lost` lines carrying `icaoHex` and `lastAircraft`. Events are recorded as the feed reports them, before adsbtop's registration lookup. The file is appended to, so a second session against the same file extends the log, and the status bar shows `rec: <file>` while recording. Note that these files grow quickly: a busy receiver produces tens of update events a second, so expect tens of megabytes per hour. A write failure (a missing directory, a full disk) shows a red chip in the status bar rather than stopping adsbtop.

### Messages panel

`M` toggles a live log of `aircraft:new`/`aircraft:update`/`aircraft:lost` events in a panel below the table. Defaults to showing only new/lost events, since `aircraft:update` fires far more often; `V` reveals every update too.

### Registration lookup

The `Reg` column and the detail view's `Registration` field resolve each aircraft's ICAO hex to its N-number (and make/model/operator in the detail view) using the bundled FAA registry. `S`earch also matches against the N-number. The registry loads in the background after startup - rows show `-` for a few seconds until it's ready, then populate automatically as matches are found.

### Location, distance, bearing, and closest approach

Passing both `--lat` and `--lon` (either together or not at all) configures your receiver's own position and makes three more columns available: `Dist` (great-circle distance in nautical miles) and `Brg` (bearing in degrees true), computed from that position to each aircraft's current position, and `CPA` (closest point of approach - see below). The detail view gets the same three fields (`Distance`/`Bearing`/`Closest approach`, shown right after `Position`), and all three columns become sortable. Without `--lat`/`--lon`, none of this appears at all - not the table columns, not the detail view rows, not the sort keys. An aircraft with no position yet shows `-` until one arrives. In a narrow terminal, auto-fit drops `Brg` and `CPA` before most other columns - see [Columns](#columns) to pin them with `--columns` or the picker.

`CPA` projects each aircraft's current true track and ground speed as a straight line and reports how close that line passes to your receiver and how long until the aircraft gets there, e.g. `2.1nm in 4m10s` - an aircraft that will pass directly overhead in four minutes reads `0.0nm in 4m00s`. Distance keeps one decimal under 10 nm and rounds to whole miles beyond that. Sorting on `CPA` orders by the distance at closest approach, so ascending puts the aircraft that will pass nearest you at the top. The column shows `-` for an aircraft with no position, no true track, or no ground speed, and also for one that is already opening (its closest approach is behind it), so a `-` next to a real `Dist` value means "not coming any closer".

For `--source beast`, the same location also serves as the receiver position used to decode surface (on-ground) CPR positions, which otherwise can't resolve from paired frames alone.

## Development

Build the package, then run the CLI out of `dist/`:

```bash
npx turbo run build --filter=@squawk/adsbtop
node apps/adsbtop/dist/cli.js --host 192.168.1.50 --lat 40.6413 --lon -73.7781
```

Give it a terminal of its own rather than the one you are watching build output in: it takes the screen over for as long as it runs and reads keys from stdin, and `Q` quits. Don't run it through a pipe or a task runner - with no terminal to measure it assumes 80 columns and stops limiting rows to the window, so neither auto-fit nor row windowing is exercised. With no station reachable it still starts, showing the `RECONNECTING` chip and an empty table, so `npm run test -w @squawk/adsbtop`, which drives the whole dashboard against a fake feed, is the faster loop for anything but a look at real traffic.

The patterns the code follows are in [CONVENTIONS.md](CONVENTIONS.md).
