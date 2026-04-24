<h1><img src="../../assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk/mcp</h1>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE.md) [![npm](https://img.shields.io/npm/v/@squawk/mcp)](https://www.npmjs.com/package/@squawk/mcp) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

Model Context Protocol (MCP) server that exposes the squawk aviation libraries as tools for LLM clients
like Claude Desktop, Cursor, and any other MCP-compatible host. A single `npx @squawk/mcp` command starts
a stdio server that surfaces airports, navaids, fixes, airways, procedures, airspace, ICAO aircraft
registrations, weather (parsing and live AWC fetch), NOTAMs, flight plan parsing, great-circle geometry,
and an E6B-style flight computer.

Part of the [@squawk](https://www.npmjs.com/org/squawk) aviation library suite. See all packages on npm.

## Quick start

Pick the snippet for your MCP client. Each one tells the host to spawn `npx @squawk/mcp` over stdio.
After editing the config, restart the client; a `squawk` (or `@squawk/mcp`) entry should appear in
the tool picker.

### Claude Desktop

Open `claude_desktop_config.json` via Settings -> Developer -> Edit Config:

```json
{
  "mcpServers": {
    "squawk": {
      "command": "npx",
      "args": ["-y", "@squawk/mcp"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project) - same shape as Claude Desktop:

```json
{
  "mcpServers": {
    "squawk": {
      "command": "npx",
      "args": ["-y", "@squawk/mcp"]
    }
  }
}
```

### VS Code (GitHub Copilot Chat)

VS Code 1.99+ ships an MCP runtime that GitHub Copilot Chat can call into agent mode.
Add to `.vscode/mcp.json` in your workspace, or to the user-level config via the
`MCP: Add Server` command:

```json
{
  "servers": {
    "squawk": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@squawk/mcp"]
    }
  }
}
```

Note the schema differs from the other clients: VS Code uses `servers` (not `mcpServers`)
and requires an explicit `"type": "stdio"`.

### Continue.dev

Continue exposes MCP via its experimental config block. In `~/.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@squawk/mcp"]
        }
      }
    ]
  }
}
```

### Picking an install version

The snippets above pass the bare package name (`@squawk/mcp`), which lets `npx` pick whatever
version it finds first - usually a previously cached one. For predictable behavior, pin the
version explicitly in the client config:

```json
{
  "mcpServers": {
    "squawk": {
      "command": "npx",
      "args": ["-y", "@squawk/mcp@0.7.0"]
    }
  }
}
```

Bump the pinned version when a new release ships (see [npm](https://www.npmjs.com/package/@squawk/mcp)
for the latest). Pinning is the most reliable option because the resolved version is part of your
config and never depends on cache state.

If you would rather have the server auto-update on every Claude Desktop (or other host) restart,
use the `@latest` tag:

```json
{
  "mcpServers": {
    "squawk": {
      "command": "npx",
      "args": ["-y", "@squawk/mcp@latest"]
    }
  }
}
```

`@latest` instructs `npx` to consult the registry for the newest version on every spawn. There is a
caveat: the `npx` cache (under `~/.npm/_npx/`) can still hold an older version that satisfies the
resolved tag, in which case the cached copy is reused. If a newer release is published and the
server still serves the old behavior after a host restart, clear the cache directory and restart
again, or fall back to a pinned version. The host process itself also has to restart for any
update to take effect, since each MCP server is a long-running stdio subprocess that loads its
code once at spawn time.

### Pinning a specific Node binary

`npx` resolves `node` through whatever PATH the host launches with. On macOS, GUI apps often
inherit a different PATH than your shell, so you may end up running an older Node than
`which node` shows. Live weather fetch tools require Node >= 22 (for global `fetch`). If the
startup log shows `WARNING: global fetch() is unavailable`, replace `"command": "npx"` with
the absolute path to a modern node + the absolute path to the installed `bin.js`:

```json
{
  "mcpServers": {
    "squawk": {
      "command": "/usr/local/bin/node",
      "args": ["/absolute/path/to/node_modules/@squawk/mcp/dist/bin.js"]
    }
  }
}
```

The server logs `[squawk-mcp] node <version> on <platform>/<arch>` and the tool-module count
to stderr on every startup so you can verify the right runtime is being used.

### Example prompts

Once connected, the model can answer things like "what airspace is over KJFK at 4500 feet?",
"give me the live METAR for KSFO and KOAK", "parse this route: KJFK DCT MERIT J60 MARTN DCT KLAX",
or "look up the aircraft with ICAO hex AC82EC".

## Standalone CLI

You can run the server directly without an MCP host to verify that it starts and responds to protocol
messages:

```sh
npx @squawk/mcp
```

The binary speaks MCP over stdio, so it expects an MCP client on the other end of stdin/stdout.
Logs go to stderr.

## Programmatic use

Embed the server inside another MCP host or a custom transport:

```typescript
import { createSquawkMcpServer } from '@squawk/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = createSquawkMcpServer();
await server.connect(new StdioServerTransport());
```

## Tool catalog

Tools are grouped by domain. Every tool returns both a human-readable text block and a structured
JSON payload (`structuredContent`) so MCP clients with strict schemas can consume the results
directly.

### Geometry (`@squawk/geo`)

| Tool                                | Purpose                                           |
| ----------------------------------- | ------------------------------------------------- |
| `great_circle_distance`             | Distance in nautical miles between two positions  |
| `great_circle_bearing`              | Initial true bearing from one position to another |
| `great_circle_bearing_and_distance` | Bearing + distance in one call                    |
| `great_circle_midpoint`             | Midpoint along the great-circle arc               |
| `great_circle_destination`          | Destination point given a bearing and distance    |

### Airports (`@squawk/airports` + `@squawk/airport-data`)

| Tool                    | Purpose                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `get_airport_by_faa_id` | Look up an airport by FAA identifier                                                   |
| `get_airport_by_icao`   | Look up an airport by ICAO code                                                        |
| `find_nearest_airports` | Find airports nearest a position with optional facility-type and runway-length filters |
| `search_airports`       | Substring search by airport name or city                                               |

### Airspace (`@squawk/airspace` + `@squawk/airspace-data`)

| Tool                         | Purpose                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `query_airspace_at_position` | Class B/C/D/E and SUA features whose lateral polygon and vertical bounds contain a point + altitude |

### Navaids (`@squawk/navaids` + `@squawk/navaid-data`)

| Tool                        | Purpose                                         |
| --------------------------- | ----------------------------------------------- |
| `get_navaid_by_ident`       | Look up navaids by identifier                   |
| `find_navaids_by_frequency` | Find navaids tuned to a given MHz/kHz frequency |
| `find_nearest_navaids`      | Find navaids nearest a position                 |
| `search_navaids`            | Substring search by name or identifier          |

### Fixes (`@squawk/fixes` + `@squawk/fix-data`)

| Tool                 | Purpose                        |
| -------------------- | ------------------------------ |
| `get_fix_by_ident`   | Look up fixes by identifier    |
| `find_nearest_fixes` | Find fixes nearest a position  |
| `search_fixes`       | Substring search by identifier |

### Airways (`@squawk/airways` + `@squawk/airway-data`)

| Tool                        | Purpose                                               |
| --------------------------- | ----------------------------------------------------- |
| `get_airway_by_designation` | Look up airways by designation                        |
| `expand_airway_segment`     | Expand an airway between an entry fix and an exit fix |
| `find_airways_by_fix`       | Reverse lookup: airways that pass through a given fix |
| `search_airways`            | Substring search by designation                       |

### Procedures (`@squawk/procedures` + `@squawk/procedure-data`)

Covers SIDs, STARs, and Instrument Approach Procedures (IAPs) from FAA CIFP.

| Tool                                      | Purpose                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `find_procedures_by_identifier`           | Every procedure publishing a CIFP identifier (same name often appears at multiple airports) |
| `get_procedure_by_airport_and_identifier` | Resolve a specific procedure at a specific airport                                          |
| `find_procedures_by_airport`              | Procedures associated with an airport                                                       |
| `find_procedures_by_airport_and_runway`   | Procedures at an airport serving a specific runway (IAP runway match or RW\* transition)    |
| `find_approaches_by_type`                 | Every IAP of a given approach classification (ILS, RNAV, VOR, etc.)                         |
| `expand_procedure`                        | Expand a procedure into its leg sequence (with optional transition merge)                   |
| `search_procedures`                       | Substring search by name or identifier, optionally filtered by procedure or approach type   |

### ICAO aircraft registry (`@squawk/icao-registry` + `@squawk/icao-registry-data`)

| Tool                          | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `lookup_aircraft_by_icao_hex` | Resolve a 24-bit ICAO hex address to an aircraft registration |

The registry data (~40 MB raw) is loaded lazily on the first lookup so sessions that never need it
do not pay the decompression cost.

### Weather (`@squawk/weather` + `@squawk/weather/fetch`)

| Tool                          | Purpose                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| `parse_metar`                 | Parse a user-supplied METAR/SPECI string                            |
| `parse_taf`                   | Parse a user-supplied TAF                                           |
| `parse_sigmet`                | Parse a US-domestic or ICAO SIGMET                                  |
| `parse_airmet`                | Parse an AIRMET bulletin                                            |
| `parse_pirep`                 | Parse a PIREP report                                                |
| `parse_winds_aloft`           | Parse an FD (winds and temperatures aloft) bulletin                 |
| `fetch_metar`                 | Fetch and parse live METARs from the Aviation Weather Center        |
| `fetch_taf`                   | Fetch and parse live TAFs                                           |
| `fetch_pirep`                 | Fetch PIREPs near a center station                                  |
| `fetch_sigmets`               | Fetch active US (CONUS) SIGMETs, optionally filtered by hazard      |
| `fetch_international_sigmets` | Fetch active international SIGMETs in ICAO format                   |
| `fetch_winds_aloft`           | Fetch and parse a live FD winds-aloft forecast by region and period |

### NOTAMs (`@squawk/notams`)

| Tool               | Purpose                              |
| ------------------ | ------------------------------------ |
| `parse_icao_notam` | Parse an ICAO-format NOTAM           |
| `parse_faa_notam`  | Parse an FAA domestic (legacy) NOTAM |

### Flight plans (`@squawk/flightplan`)

| Tool                     | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `parse_flightplan_route` | Parse an ICAO Item 15 route into structured route elements |
| `compute_route_distance` | Total great-circle route distance with optional ETE        |

### Flight computer (`@squawk/flight-math`)

Selected E6B calculations: any operation that embeds a non-trivial constant, formula, or model
(WMM2025, NOAA solar, compressible-flow pitot equations, etc.) is exposed; trivial unit math is
left to the model itself.

| Tool                                             | Purpose                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `compute_density_altitude`                       | Density altitude from field observations                          |
| `compute_true_altitude`                          | True altitude from indicated altitude with temperature correction |
| `compute_calibrated_airspeed_from_true_airspeed` | CAS from TAS via the ICAO compressible-flow equations             |
| `solve_wind_triangle`                            | Heading + groundspeed from TAS, course, and wind                  |
| `compute_headwind_crosswind`                     | Headwind/crosswind component breakdown                            |
| `find_wind_from_track`                           | Reverse wind triangle from observed ground track                  |
| `compute_crosswind_component`                    | Absolute crosswind for a runway                                   |
| `compute_top_of_descent_distance`                | TOD from glidepath angle                                          |
| `compute_top_of_descent_distance_from_rate`      | TOD from descent rate + groundspeed                               |
| `compute_required_descent_rate`                  | Required descent rate over a distance                             |
| `compute_required_climb_rate`                    | Required climb rate over a distance                               |
| `compute_visual_descent_point`                   | VDP for a non-precision approach                                  |
| `recommend_holding_pattern_entry`                | Direct/teardrop/parallel entry per AIM 5-3-8                      |
| `compute_standard_rate_bank_angle`               | Bank angle for a 3 deg/sec turn at a given TAS                    |
| `compute_turn_radius`                            | Turn radius for a given TAS and bank angle                        |
| `compute_glide_distance_with_wind`               | Glide distance scaled by groundspeed/TAS ratio                    |
| `compute_solar_times`                            | Sunrise, sunset, civil twilight (NOAA algorithm)                  |
| `is_daytime`                                     | Daytime/nighttime per FAR 1.1 at a UTC instant                    |
| `compute_magnetic_declination`                   | WMM2025 declination at a position                                 |
| `convert_true_to_magnetic_bearing`               | True -> magnetic bearing using WMM2025                            |
| `convert_magnetic_to_true_bearing`               | Magnetic -> true bearing using WMM2025                            |
| `compute_fuel_required`                          | Fuel for a leg given distance, GS, and burn rate                  |
| `compute_point_of_no_return`                     | PNR with separate outbound/return groundspeeds                    |
| `compute_equal_time_point`                       | ETP with separate continuing/returning groundspeeds               |

### Server diagnostics

| Tool                 | Purpose                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `get_dataset_status` | Report NASR cycle date, build timestamp, and record counts for every loaded snapshot (incl. lazy-load state) |

## Configuration

| Environment variable  | Effect                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SQUAWK_AWC_BASE_URL` | Override the Aviation Weather Center base URL used by every `fetch_*` tool. Defaults to `https://aviationweather.gov/api/data`. Useful for proxies and regional mirrors. |

## Notes

- The bundled datasets (airports, airspace, navaids, fixes, airways from FAA NASR; procedures from
  FAA CIFP) cover the contiguous United States plus the territories included in the respective FAA
  subscriptions. Outside the US the lookup tools will return empty results. Use `get_dataset_status`
  to confirm which NASR and CIFP cycles the running server is serving.
- Live weather tools issue HTTPS requests to `https://aviationweather.gov/api/data/...` (or the
  override above). They are the only tools that touch the network at invocation time; everything
  else operates against bundled snapshots in memory.
- The bundled snapshots are decompressed and indexed once when the server starts. Expect a few
  hundred milliseconds of startup time. The aircraft registration snapshot (the largest) is loaded
  lazily on the first `lookup_aircraft_by_icao_hex` call.
