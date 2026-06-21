---
'@squawk/navaids': minor
'@squawk/fixes': minor
'@squawk/mcp': minor
---

### Added

- **@squawk/navaids** `byIdentAtPosition(ident, lat, lon, toleranceNm?)` resolver method returns the single navaid sharing an identifier that lies nearest a geographic position. The same identifier can be published by more than one station (a co-located NDB and VOR/DME, or two distant stations reusing a code); this disambiguates the collision by proximity to a known point such as a map-click location or an adjacent route waypoint. Pass `toleranceNm` to reject matches beyond a maximum great-circle distance, or omit it to let the nearest match win regardless.
- **@squawk/fixes** `byIdentAtPosition(ident, lat, lon, toleranceNm?)` resolver method returns the single fix sharing an identifier that lies nearest a geographic position. The same identifier can be published in more than one ICAO region; this disambiguates the collision by proximity to a known point. Pass `toleranceNm` to bound the match by great-circle distance, or omit it to let the nearest match win.
- **@squawk/mcp** adds `get_navaid_by_ident_at_position` and `get_fix_by_ident_at_position` tools wrapping the new resolver methods, each returning the nearest matching record (or null) for a shared identifier near a given position.
