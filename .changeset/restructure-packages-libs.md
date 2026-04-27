---
'@squawk/airport-data': patch
'@squawk/airports': patch
'@squawk/airspace': patch
'@squawk/airspace-data': patch
'@squawk/airway-data': patch
'@squawk/airways': patch
'@squawk/fix-data': patch
'@squawk/fixes': patch
'@squawk/flight-math': patch
'@squawk/flightplan': patch
'@squawk/geo': patch
'@squawk/icao-registry': patch
'@squawk/icao-registry-data': patch
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

### Changed

- Updated `repository.directory` in each package's manifest to reflect the monorepo's new internal layout. The "View repository" link on npmjs.com now points to `packages/libs/<name>/` instead of `packages/<name>/`. No code or API changes - this is package metadata only.
