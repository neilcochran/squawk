---
'@squawk/airport-data': patch
'@squawk/airports': patch
'@squawk/airspace-data': patch
'@squawk/airspace': patch
'@squawk/airway-data': patch
'@squawk/airways': patch
'@squawk/fix-data': patch
'@squawk/fixes': patch
'@squawk/flight-math': patch
'@squawk/flightplan': patch
'@squawk/geo': patch
'@squawk/icao-registry-data': patch
'@squawk/icao-registry': patch
'@squawk/mcp': patch
'@squawk/navaid-data': patch
'@squawk/navaids': patch
'@squawk/notams': patch
'@squawk/procedure-data': patch
'@squawk/procedures': patch
'@squawk/types': patch
'@squawk/units': patch
'@squawk/weather': patch
---

### Fixed

- Fix the broken MIT license badge link in every package README. The relative path was one level too shallow, so on GitHub (and on npm renderers that resolve relative paths against the repo) the badge landed on a non-existent `packages/LICENSE.md` instead of the repo's `LICENSE.md`. The badge now resolves correctly.
- Fix the broken `Documentation` link in `@squawk/flight-math`'s README. The typedoc URL slug used an underscore (`_squawk_flight_math.html`) instead of the dash form every sibling README uses (`_squawk_flight-math.html`), returning 404. Now points at the live docs page.
