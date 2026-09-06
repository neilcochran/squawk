# @squawk/adsbtop

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
