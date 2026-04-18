---
'@squawk/mcp': minor
---

- Add `@squawk/mcp` package: a Model Context Protocol stdio server that exposes squawk libraries as tools for LLM clients like Claude Desktop and Cursor.
- Add `squawk-mcp` CLI binary, runnable via `npx @squawk/mcp`.
- Add `createSquawkMcpServer()` factory for embedding the server in a custom MCP host.
- Add 5 great-circle geometry tools wrapping `@squawk/geo`: `great_circle_distance`, `great_circle_bearing`, `great_circle_bearing_and_distance`, `great_circle_midpoint`, `great_circle_destination`.
- Add 4 airport lookup tools wrapping `@squawk/airports`: `get_airport_by_faa_id`, `get_airport_by_icao`, `find_nearest_airports`, `search_airports`.
