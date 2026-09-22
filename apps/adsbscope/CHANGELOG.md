# @squawk/adsbscope

## 0.1.1

### Patch Changes

- Updated dependencies [9935693]
  - @squawk/airport-data@0.8.0
  - @squawk/airspace-data@0.6.0
  - @squawk/fix-data@0.7.0
  - @squawk/navaid-data@0.7.0

## 0.1.0

### Minor Changes

- 1fa7115: ### Added

  - Initial release. `adsbscope` is a small CLI that connects to a local dump1090-fa station through `@squawk/adsb-feed` and serves a web page plotting every tracked aircraft on an ATC-style radar scope centered on your receiver. `--lat`/`--lon` are required; `--source` picks the `beast` (default), `sbs`, or `json` output, and `--replay` plays back an `adsbtop --record` file instead of a live station.
  - Two view styles, switchable while it runs: `digital`, a modern scope with position symbols, history trails, velocity vectors, and data blocks that are kept off one another, and `analog`, a sweep-era scope whose rotating beam paints returns that fade behind it. `--mode` picks the one to start in.
  - A video map under the traffic, built from the bundled FAA airport, navaid, fix, and airspace snapshots, with detail that thins as you zoom out and a `Basic | Full | Off` selector.
  - Emergencies are marked with an `EM` / `RF` / `HJ`-style code after the callsign, flashing targets in `digital`, a bloomed return in `analog`, and an `EMERGENCY` list that names the aircraft even when it is off the scope.
  - Click an aircraft, its data block, or its tag to inspect it, including its registration record from the bundled FAA registry; registered models time-share the second line of a data block. `--no-registry` skips loading the registry on a small host.
  - A tab list of aircraft that have not sent a position, a bookmarkable URL for the view style, range, and selection, collapsible controls, keyboard control of everything on screen, and a layout that works from a phone to a desktop window.
  - The server binds to `127.0.0.1` by default (`--bind` to change it), answers only GET and HEAD, checks the `Host` header, and validates every request parameter.
