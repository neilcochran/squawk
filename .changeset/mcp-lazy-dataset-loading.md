---
'@squawk/mcp': minor
---

### Changed

- Bundled snapshots load on demand instead of at startup. Every dataset used to be
  decompressed and indexed when the server module loaded, so a session that only asked about
  airports still paid for procedures, airspace, and the rest. Each dataset is now imported
  the first time a tool actually reads it, which also means disabling a tool group genuinely
  stops paying for its data rather than only shortening the catalog. The tradeoff is that
  the first call against a dataset carries its load, so one lookup can take a few hundred
  milliseconds where it used to be immediate; every later call against that dataset is
  served from memory. Parsing a route string is the largest single first call, since
  `flightplan` draws on five snapshots at once.
- `get_dataset_status` reports every dataset's cycle date, build timestamp, and record
  counts whether or not that dataset is loaded, and adds a `loaded` flag per dataset saying
  which are currently in memory. It reads the data packages' new `/meta` subpaths, so asking
  how current the data is no longer pulls every snapshot into memory to answer.

### Fixed

- Concurrent first calls needing the same dataset could each build their own resolver index,
  briefly doubling what that dataset cost. Loads are now shared, so a dataset is
  decompressed and indexed once per process however many calls arrive at once.
