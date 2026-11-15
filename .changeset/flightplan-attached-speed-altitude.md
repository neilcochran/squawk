---
'@squawk/flightplan': minor
'@squawk/mcp': patch
---

**@squawk/flightplan**

### Added

- A speed/altitude group attached to a route point with a slash, the ICAO form for a change of speed or level (`ENE/N0450F370`), is now parsed. The point resolves as it would on its own, including as the fix where an airway is joined or left, and a `speedAltitude` element follows it with a new `fromPoint` field naming the point. Previously the whole token was unresolved, so an airway joined or left at that point failed to expand.

**@squawk/mcp**

### Changed

- `parse_flightplan_route` describes speed/altitude groups attached to a point and the `fromPoint` field.
