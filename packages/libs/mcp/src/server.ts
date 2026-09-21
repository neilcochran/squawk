/**
 * @packageDocumentation
 * Server factory for @squawk/mcp. Assembles an {@link McpServer} carrying the
 * squawk aviation tool modules the caller asked for, defaulting to all of them.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  ToolGroupConfigError,
  normalizeToolGroups,
  resolveToolGroupsFromEnv,
  type ToolGroupName,
} from './tool-groups.js';
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
 * Registrar for each toggleable tool group. Keying by {@link ToolGroupName}
 * makes the mapping exhaustive: adding a name to `TOOL_GROUP_NAMES` without
 * wiring its registrar here is a compile error, so the group list and the
 * modules it toggles cannot drift apart.
 */
const TOOL_GROUP_REGISTRARS: Record<ToolGroupName, (server: McpServer) => void> = {
  geo: registerGeoTools,
  'flight-math': registerFlightMathTools,
  airports: registerAirportTools,
  airspace: registerAirspaceTools,
  navaids: registerNavaidTools,
  fixes: registerFixTools,
  airways: registerAirwayTools,
  procedures: registerProcedureTools,
  'icao-registry': registerIcaoRegistryTools,
  weather: registerWeatherTools,
  notams: registerNotamTools,
  flightplan: registerFlightplanTools,
  datasets: registerDatasetTools,
};

/**
 * Options accepted by {@link createSquawkMcpServer}.
 */
export interface CreateSquawkMcpServerOptions {
  /**
   * Tool groups to register. Omit to resolve the set from the
   * `SQUAWK_MCP_TOOLS` / `SQUAWK_MCP_DISABLE_TOOLS` environment variables,
   * which default to every group. Order is ignored; groups always register in
   * `TOOL_GROUP_NAMES` order.
   */
  readonly toolGroups?: readonly ToolGroupName[];
}

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
 * Creates an MCP server carrying the requested squawk aviation tool groups,
 * defaulting to all of them.
 *
 * Disabling a group keeps its tools out of the catalog the LLM client sees,
 * which is the point: the full catalog is roughly 18k tokens of context on
 * every session. It does not reduce the server's startup time or memory
 * footprint - the bundled snapshots are imported and indexed at module load
 * regardless of which groups register.
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
 * const server = createSquawkMcpServer({ toolGroups: ['airports', 'geo'] });
 * await server.connect(new StdioServerTransport());
 * ```
 *
 * @param options - Server options. Omit to honor the environment variables.
 * @returns A fully configured MCP server instance. Connect it to a transport
 *          (typically `StdioServerTransport` for CLI use) via
 *          `server.connect(transport)` to begin handling protocol messages.
 * @throws {ToolGroupConfigError} when `options.toolGroups` names an unknown
 *         group or is empty, or when the environment variables cannot be
 *         honored (both set at once, unknown names, or nothing left enabled).
 */
export function createSquawkMcpServer(options?: CreateSquawkMcpServerOptions): McpServer {
  const server = new McpServer({
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
  });

  let enabledGroups: readonly ToolGroupName[];
  if (options?.toolGroups === undefined) {
    const resolution = resolveToolGroupsFromEnv(process.env);
    if (!resolution.ok) {
      throw new ToolGroupConfigError(resolution.error);
    }
    enabledGroups = resolution.toolGroups;
  } else {
    enabledGroups = normalizeToolGroups(options.toolGroups);
  }

  for (const group of enabledGroups) {
    TOOL_GROUP_REGISTRARS[group](server);
  }

  return server;
}
