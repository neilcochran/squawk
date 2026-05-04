---
'@squawk/icao-registry': minor
---

### Removed

- Removed undocumented lower-level FAA parsing internals from the public entrypoint: `parseMasterCsv`, `parseAcftRefCsv`, `joinRegistryRecords`, the `MasterRecord` and `AcftRefRecord` types, and the `AIRCRAFT_TYPE_MAP` and `ENGINE_TYPE_MAP` constants. These were never documented as supported API; the documented `parseFaaRegistryZip` parser is unchanged and remains the path for consumers that want to fetch fresh FAA registry data.
