---
'@squawk/types': minor
'@squawk/airport-data': minor
'@squawk/airports': minor
'@squawk/mcp': minor
---

### Added

- Required `timezone: string` field on the `Airport` type in `@squawk/types`, carrying an IANA zone identifier (e.g. `America/New_York`) resolved from the airport's lat/lon. Pass directly to `Intl.DateTimeFormat`, `Temporal`, `date-fns-tz`, `luxon`, etc. to format timestamps in the airport's local time with no runtime timezone dependency. Consumers constructing `Airport` objects by hand must now populate the field.
- IANA `timezone` resolved for every record in `@squawk/airport-data` (19,097 US, territorial, and selected foreign facilities the FAA publishes). Resolved at build time from timezone-boundary-builder polygons.
- "Local time at an airport" section in the `@squawk/airports` README showing `Intl.DateTimeFormat` usage.

### Changed

- `get_airport_by_faa_id`, `get_airport_by_icao`, `find_nearest_airports`, and `search_airports` tools in `@squawk/mcp` now include the new `timezone` field on every returned airport record.
