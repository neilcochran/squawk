/**
 * @packageDocumentation
 * MCP tool module exposing build provenance and record counts for every
 * bundled FAA snapshot the server can serve. Lets an LLM client report
 * exactly which NASR cycle and registry vintage answered a query - critical
 * context for aviation use, where stale data is a real safety concern.
 *
 * Every dataset's metadata comes from its data package's `/meta` subpath, a
 * generated constant carrying the cycle date, build timestamp, and record
 * counts. Reading it costs nothing, so reporting status never pulls a
 * snapshot into memory that a session did not otherwise need. Each entry also
 * carries whether its records are currently loaded, which is the one fact
 * that has to be read from the resolver layer.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { usBundledAirportsProperties } from '@squawk/airport-data/meta';
import { usBundledAirspaceProperties } from '@squawk/airspace-data/meta';
import { usBundledAirwaysProperties } from '@squawk/airway-data/meta';
import { usBundledFixesProperties } from '@squawk/fix-data/meta';
import { usBundledNavaidsProperties } from '@squawk/navaid-data/meta';
import { usBundledProceduresProperties } from '@squawk/procedure-data/meta';

import {
  getBundledDatasetLoadState,
  getIcaoRegistryMetadata,
  isIcaoRegistryLoaded,
} from '../resolvers.js';

/**
 * Registers the `get_dataset_status` tool on the given MCP server. The tool
 * takes no input and reports the cycle effective date, generation timestamp,
 * and record counts for every bundled snapshot, along with whether each one
 * is currently loaded. Answering does not load anything.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerDatasetTools(server: McpServer): void {
  server.registerTool(
    'get_dataset_status',
    {
      title: 'Report status of every bundled dataset',
      description:
        'Returns the cycle effective date (FAA NASR for airports/airspace/navaids/fixes/airways; FAA CIFP for procedures), build timestamp, and record counts for every dataset the server can serve, plus a `loaded` flag saying whether that dataset is currently in memory. Use this when a user asks "how current is the data?" or before answering a question that depends on procedure/navaid currency. Calling it is cheap and never forces a dataset to load, so `loaded: false` means only that nothing has needed that snapshot yet - the cycle dates it reports are accurate either way. The aircraft registry is an optional peer package, so it reports its vintage only once a lookup has loaded it.',
      inputSchema: {},
    },
    () => {
      const loadState = getBundledDatasetLoadState();
      const registryMetadata = getIcaoRegistryMetadata();
      const datasets = {
        airports: { loaded: loadState.airports, ...usBundledAirportsProperties },
        airspace: { loaded: loadState.airspace, ...usBundledAirspaceProperties },
        navaids: { loaded: loadState.navaids, ...usBundledNavaidsProperties },
        fixes: { loaded: loadState.fixes, ...usBundledFixesProperties },
        airways: { loaded: loadState.airways, ...usBundledAirwaysProperties },
        procedures: { loaded: loadState.procedures, ...usBundledProceduresProperties },
        icaoRegistry:
          registryMetadata !== undefined
            ? {
                loaded: true,
                generatedAt: registryMetadata.generatedAt,
                recordCount: registryMetadata.recordCount,
              }
            : { loaded: isIcaoRegistryLoaded() },
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(datasets, null, 2) }],
        structuredContent: { datasets },
      };
    },
  );
}
