---
'@squawk/airport-data': minor
'@squawk/navaid-data': minor
'@squawk/airspace': minor
'@squawk/fix-data': minor
'@squawk/types': minor
'@squawk/mcp': minor
---

- Change `state` to optional (`string | undefined`) on `Airport`, `Navaid`, and `Fix` in `@squawk/types`. Consumers that read `.state` must now handle `undefined` for non-US records.

- Include selected Canadian, Mexican, Caribbean, and Pacific facilities published by the FAA in `@squawk/airport-data`, `@squawk/navaid-data`, and `@squawk/fix-data` (+147 airports, +59 navaids, +645 fixes). Foreign records have `country` populated and `state` undefined.
- Export `lookupCode` from `@squawk/build-shared`, a classification-map lookup helper that logs a one-time warning on unknown NASR codes so future cycle additions do not silently drop records.
