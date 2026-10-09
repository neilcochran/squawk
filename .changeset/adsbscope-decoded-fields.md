---
'@squawk/adsb-feed': minor
'@squawk/adsbscope': minor
'@squawk/adsbtop': patch
---

**@squawk/adsb-feed**

### Added

- The JSON source now populates `targetState` from `aircraft.json`'s `nav_*` fields: the selected altitude (`nav_altitude_mcp`, or `nav_altitude_fms` when that is all there is), selected heading, altimeter setting, and the autopilot modes and TCAS status from `nav_modes`, with the accuracy and integrity fields read from `nac_p`, `nic_baro`, and `sil`. The mode flags are undefined when `nav_modes` is absent, which dump1090-fa writes when the aircraft reports no mode status; `tcasOperational` is then false, since dump1090-fa only reports TCAS alongside the other modes. An entry with no `nav_*` field has no `targetState`, as before.

**@squawk/adsbscope**

### Added

- Position symbols follow the aircraft's broadcast category in the digital style: a circle for a rotorcraft, a triangle for a glider, balloon, or ultralight, a diamond for a drone, a cross for a surface vehicle. Fixed-wing aircraft keep the square, as does any aircraft whose source reports no category.
- An aircraft squawking ident shows `ID` after its callsign everywhere the callsign is shown, draws its digital symbol at twice the size in the usual color, and returns twice as wide and half again as thick on the analog tube. An emergency code keeps the slot on line one when both apply.
- The digital data block's second line now time-shares three ways, in unison: altitude and speed for 2.5 s, the type for 1.5 s, and the altitude the aircraft is climbing or descending to for 1.5 s (`^380`, `v290`), shown only while it has more than 300 ft to go. A block skips any part it has nothing for.
- The type line prefixes a heavy's model with `H/` (`H/777-222`), and shows the category's three-letter code (`HVY`, `LRG`) for an aircraft the registry does not know but which broadcasts a category.
- The inspect panel adds Category, Selected altitude, Selected heading, Autopilot (whether it is on, and the modes engaged), Airspeed (indicated and true), and Heading rows, each only when reported, and notes a squawk that has just changed. It now caps its height and scrolls, so every row fits a landscape phone.
- A `dev:server` script that compiles the server and runs the CLI with whatever follows `--`, so the UI dev server has something to proxy to without a separate build step.

### Changed

- The inspect panel's Speed row is now Ground speed.

**@squawk/adsbtop**

### Changed

- With `--source json`, the detail view's `Target state` row now shows the selected altitude, heading, and autopilot from `aircraft.json`'s `nav_*` fields instead of `-`.
