# @squawk/adsbscope

## 0.1.2

### Patch Changes

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

- Updated dependencies [a0f2ee1]
  - @squawk/adsb-feed@0.8.0

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
