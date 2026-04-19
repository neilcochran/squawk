---
'@squawk/icao-registry-data': patch
'@squawk/procedure-data': patch
'@squawk/icao-registry': patch
'@squawk/airport-data': patch
'@squawk/airway-data': patch
'@squawk/flight-math': patch
'@squawk/navaid-data': patch
'@squawk/flightplan': patch
'@squawk/procedures': patch
'@squawk/airports': patch
'@squawk/airspace': patch
'@squawk/fix-data': patch
'@squawk/airways': patch
'@squawk/navaids': patch
'@squawk/weather': patch
'@squawk/notams': patch
'@squawk/fixes': patch
'@squawk/types': patch
'@squawk/geo': patch
'@squawk/mcp': patch
---

- Pin internal `@squawk/*` workspace dependencies to caret ranges (e.g. `^0.3.2`) instead of `"*"` so `npm install` of any `@squawk/*` package resolves transitive workspace deps to compatible registry versions instead of reusing stale cached ones; previously `npx -y @squawk/mcp` could pair `@squawk/mcp@0.4.0` with an older cached `@squawk/flightplan@0.3.1` and serve buggy behavior even when `0.3.2` was already published.
