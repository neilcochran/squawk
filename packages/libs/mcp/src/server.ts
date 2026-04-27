/**
 * @packageDocumentation
 * Server factory for @squawk/mcp. Assembles an {@link McpServer} preloaded
 * with every squawk aviation tool module.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAirportTools } from './tools/airports.js';
import { registerAirspaceTools } from './tools/airspace.js';
import { registerAirwayTools } from './tools/airways.js';
import { registerDatasetTools } from './tools/datasets.js';
import { registerFixTools } from './tools/fixes.js';
import { registerFlightMathTools } from './tools/flight-math.js';
import { registerFlightplanTools } from './tools/flightplan.js';
import { registerGeoTools } from './tools/geo.js';
import { registerIcaoRegistryTools } from './tools/icao-registry.js';
import { registerNavaidTools } from './tools/navaids.js';
import { registerNotamTools } from './tools/notams.js';
import { registerProcedureTools } from './tools/procedures.js';
import { registerWeatherTools } from './tools/weather.js';

const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), '../package.json');
const packageMeta: { name: string; version: string } = JSON.parse(
  readFileSync(packageJsonPath, 'utf-8'),
);

/**
 * Ordered list of tool-module registrars invoked during server construction.
 * Holding them in a single array keeps {@link createSquawkMcpServer} symmetric
 * across modules and lets {@link TOOL_MODULE_COUNT} stay accurate without
 * manual bookkeeping.
 */
const TOOL_MODULE_REGISTRARS: ((server: McpServer) => void)[] = [
  registerGeoTools,
  registerFlightMathTools,
  registerAirportTools,
  registerAirspaceTools,
  registerNavaidTools,
  registerFixTools,
  registerAirwayTools,
  registerProcedureTools,
  registerIcaoRegistryTools,
  registerWeatherTools,
  registerNotamTools,
  registerFlightplanTools,
  registerDatasetTools,
];

/**
 * Number of tool modules registered by {@link createSquawkMcpServer}. Exposed
 * so the stdio entrypoint can include the count in its startup diagnostic
 * without re-counting at runtime.
 */
export const TOOL_MODULE_COUNT: number = TOOL_MODULE_REGISTRARS.length;

/**
 * Package name as published to npm. Convenient for diagnostic logs that want
 * to identify the running server without re-reading `package.json`.
 */
export const PACKAGE_NAME: string = packageMeta.name;

/**
 * Package version pulled from `package.json` at module load. Mirrored as the
 * server's `version` field and reused by the stdio entrypoint diagnostic.
 */
export const PACKAGE_VERSION: string = packageMeta.version;

/**
 * Creates an MCP server preloaded with every squawk aviation tool module.
 *
 * Tool registration triggers eager construction of the shared resolver
 * singletons in `./resolvers.js` for every domain except the ICAO aircraft
 * registry, which loads on first lookup. Live weather fetch tools issue
 * outbound HTTPS requests to the Aviation Weather Center text API only when
 * invoked.
 *
 * ```typescript
 * import { createSquawkMcpServer } from '@squawk/mcp';
 * import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
 *
 * const server = createSquawkMcpServer();
 * await server.connect(new StdioServerTransport());
 * ```
 *
 * @returns A fully configured MCP server instance. Connect it to a transport
 *          (typically `StdioServerTransport` for CLI use) via
 *          `server.connect(transport)` to begin handling protocol messages.
 */
export function createSquawkMcpServer(): McpServer {
  const server = new McpServer({
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
  });

  for (const register of TOOL_MODULE_REGISTRARS) {
    register(server);
  }

  return server;
}
