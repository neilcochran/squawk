---
'@squawk/mcp': minor
---

### Changed

- `@squawk/icao-registry-data` is now declared as an optional peer dependency of `@squawk/mcp` instead of a required dependency. Default installs of `@squawk/mcp` no longer pull in the ~8 MB FAA aircraft-registry snapshot, shrinking the cold-install footprint for users who do not query ICAO hex codes. To restore the previous behavior and enable `lookup_aircraft_by_icao_hex`, install the data package alongside `@squawk/mcp`: `npm install @squawk/icao-registry-data` for local installs, or add `-p @squawk/icao-registry-data` to the `npx` args in your MCP client config (e.g. `npx -y -p @squawk/icao-registry-data @squawk/mcp`). When the data package is missing, the tool stays listed in the catalog and returns a structured `isError: true` result naming the dataset, package, and exact install command so the LLM client can surface the action to the user; the rest of the server keeps running normally.
