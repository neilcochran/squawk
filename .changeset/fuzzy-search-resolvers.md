---
'@squawk/airports': minor
'@squawk/navaids': minor
'@squawk/fixes': minor
'@squawk/airways': minor
'@squawk/airspace': minor
'@squawk/procedures': minor
'@squawk/mcp': minor
---

### Changed

- Every query library's `search()` now performs fuzzy, scored matching (backed by the new `@squawk/search`) instead of plain substring matching. `search()` returns a `<Entity>SearchResult[]` sorted best-match first, where each result carries `{ <entity>, score, matchedField, ranges }`: a normalized `[0, 1]` score, the field that produced the best match, and the matched character ranges for highlighting. Each query type gains an optional `minScore` filter to drop weak matches.
  - **Breaking:** `@squawk/airports`, `@squawk/navaids`, `@squawk/fixes`, `@squawk/airways`, and `@squawk/procedures` previously returned a bare `<Entity>[]` from `search()`; they now return the scored `<Entity>SearchResult[]` shape. Read `result.<entity>` to recover the record.

### Added

- `@squawk/airspace` gains a `search()` method (`AirspaceSearchQuery` / `AirspaceSearchResult`) that fuzzily matches airspace features across identifier and name, consistent with the other query libraries.
- `@squawk/mcp` adds a `search_airspace` tool and updates the existing `search_*` tools (navaids, fixes, airways, airports, procedures) to emit the scored result shape with an optional `minScore` argument.
