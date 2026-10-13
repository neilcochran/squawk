---
'@squawk/mcp': patch
---

### Changed

- `get_airport_by_faa_id` and `get_airport_by_icao` describe the airport record they return: frequencies in MHz with the FAA's receive-only and on-request qualifiers, the providing facility, call signs and remarks, runways with their pavement classification and RVR locations, and the traffic pattern altitude in feet above the field.
