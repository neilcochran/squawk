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
import { registerGeoTools } from './tools/geo.js';

const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), '../package.json');
const packageMeta: { version: string } = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

/**
 * Creates an MCP server preloaded with every squawk aviation tool module.
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
  registerAirportTools(server);

  return server;
}
