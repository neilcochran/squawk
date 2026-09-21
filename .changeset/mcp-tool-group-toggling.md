---
'@squawk/mcp': minor
---

### Added

- Tool groups can be turned on and off at startup, so a client only carries the part of
  the catalog it actually uses. The full catalog is 79 tools and roughly 18k tokens of
  context in every session; `SQUAWK_MCP_TOOLS=airports,navaids,fixes,geo` takes that to 18
  tools and roughly 4.3k. Set `SQUAWK_MCP_TOOLS` to name the groups to register, or
  `SQUAWK_MCP_DISABLE_TOOLS` to name the ones to skip - the two are mutually exclusive, and
  with neither set every group registers as before. There is one group per domain, named
  for it: `geo`, `flight-math`, `airports`, `airspace`, `navaids`, `fixes`, `airways`,
  `procedures`, `icao-registry`, `weather`, `notams`, `flightplan`, and `datasets`. Names
  are case-insensitive, and the server refuses to start, explaining itself on stderr,
  rather than serve a catalog you did not ask for. Groups gate what the client sees, not
  what the server loads, so a smaller catalog is not a smaller or faster process.
- `createSquawkMcpServer()` takes a `toolGroups` option for the same thing in code, which
  takes precedence over the environment. `TOOL_GROUP_NAMES` and the `ToolGroupName` type
  enumerate the valid groups, and an invalid list throws `ToolGroupConfigError`.

### Changed

- The startup diagnostic now reports how many tool groups registered out of the total and
  names the ones that did not, so a mistyped group variable surfaces in the host's MCP log
  instead of as tools the model never calls.
