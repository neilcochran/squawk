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
const packageMeta: { version: string } = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

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
    name: '@squawk/mcp',
    version: packageMeta.version,
  });

  registerGeoTools(server);
  registerFlightMathTools(server);
  registerAirportTools(server);
  registerAirspaceTools(server);
  registerNavaidTools(server);
  registerFixTools(server);
  registerAirwayTools(server);
  registerProcedureTools(server);
  registerIcaoRegistryTools(server);
  registerWeatherTools(server);
  registerNotamTools(server);
  registerFlightplanTools(server);

  return server;
}
