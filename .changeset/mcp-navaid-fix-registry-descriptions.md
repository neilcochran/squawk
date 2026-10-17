---
'@squawk/mcp': patch
---

### Changed

- `lookup_aircraft_by_icao_hex` describes the registration status and expiration date it returns, and says that a record is not necessarily a current registration.
- `get_fix_by_ident` describes a fix's navaid associations, whose bearing and distance are each optional.
- `get_navaid_by_ident` describes the remarks, DME status and VOR receiver checkpoints a navaid carries.
