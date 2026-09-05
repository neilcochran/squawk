---
'@squawk/adsbtop': minor
---

### Added

- Terminal dashboard for live ADS-B aircraft tracking, connecting to a local dump1090-fa station over its JSON, SBS, or Beast output (`--source`, `--host`, `--port`/`--url`).
- A live-updating aircraft table - ICAO hex, callsign, N-number (resolved via the bundled FAA registry), squawk, altitude, ground speed, heading, vertical rate, on-ground indicator, and age since last seen - sortable by ICAO hex, callsign, altitude, ground speed, or age (`O`), with a compact column mode for narrow terminals (`C`). Aircraft squawking an emergency code (7500/7600/7700) render in bold red.
- A row cursor (arrow keys) and a detail view (`Enter`/`D`) showing every field for the selected aircraft.
- Search (`S`) by ICAO hex, callsign, squawk, or N-number, with `N`/`Shift+N` to cycle matches.
- A live messages panel (`M`) logging new/update/lost feed events, with a verbosity toggle (`V`) between new/lost only and every update.
- `P`ause, a help overlay (`H`), and a status header showing connection info and message rate.
- An optional receiver location (`--lat`/`--lon`) adds Dist/Brg table columns and matching detail-view fields, showing distance and bearing from that point to each tracked aircraft; for `--source beast`, the same location also improves on-ground position decoding.
