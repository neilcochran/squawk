---
'@squawk/types': minor
---

### Added

- `is<Name>` type guards and `<NAME>S` const arrays for the user-facing string-literal union types: `AirspaceType`, `ArtccStratum`, `FacilityType`, `AirwayType`, `NavaidType`, `FixUseCode`. Each guard narrows an external string into the union, and each const array is the single source of truth for value-side iteration. Useful when consuming URL params, config files, or MCP tool inputs that need validation before being used as a typed filter; centralizing the membership list here means each consumer no longer hand-rolls its own predicate that silently drifts when a new union member is added. The arrays are branded with `as const satisfies readonly <Type>[]` so dropping a member or adding one to the type without updating the array fails the build.
