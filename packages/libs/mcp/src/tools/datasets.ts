/**
 * @packageDocumentation
 * MCP tool module exposing build provenance and record counts for every
 * bundled FAA snapshot the server loads. Lets an LLM client report exactly
 * which NASR cycle and registry vintage answered a query - critical context
 * for aviation use, where stale data is a real safety concern.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { usBundledAirports } from '@squawk/airport-data';
import { usBundledAirspace } from '@squawk/airspace-data';
import { usBundledAirways } from '@squawk/airway-data';
import { usBundledFixes } from '@squawk/fix-data';
import { usBundledNavaids } from '@squawk/navaid-data';
import { usBundledProcedures } from '@squawk/procedure-data';
import { getIcaoRegistryMetadata, isIcaoRegistryLoaded } from '../resolvers.js';

/**
 * Registers the `get_dataset_status` tool on the given MCP server. The tool
 * takes no input and reports the NASR cycle date, generation timestamp, and
 * record counts for each loaded snapshot. The lazily-loaded ICAO registry
 * reports its load state without being initialized as a side effect.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerDatasetTools(server: McpServer): void {
  server.registerTool(
    'get_dataset_status',
    {
      title: 'Report status of every bundled dataset',
      description:
        'Returns the cycle effective date (FAA NASR for airports/airspace/navaids/fixes/airways; FAA CIFP for procedures), build timestamp, and record counts for each dataset the server loads (airports, airspace, navaids, fixes, airways, procedures, ICAO aircraft registry). Use this when a user asks "how current is the data?" or before answering a question that depends on procedure/navaid currency. The aircraft registry is lazily loaded and reports its load state without forcing initialization.',
      inputSchema: {},
    },
    () => {
      const registryMetadata = getIcaoRegistryMetadata();
      const datasets = {
        airports: {
          nasrCycleDate: usBundledAirports.properties.nasrCycleDate,
          generatedAt: usBundledAirports.properties.generatedAt,
          recordCount: usBundledAirports.properties.recordCount,
        },
        airspace: {
          nasrCycleDate: usBundledAirspace.properties.nasrCycleDate,
          generatedAt: usBundledAirspace.properties.generatedAt,
          featureCount: usBundledAirspace.properties.featureCount,
        },
        navaids: {
          nasrCycleDate: usBundledNavaids.properties.nasrCycleDate,
          generatedAt: usBundledNavaids.properties.generatedAt,
          recordCount: usBundledNavaids.properties.recordCount,
        },
        fixes: {
          nasrCycleDate: usBundledFixes.properties.nasrCycleDate,
          generatedAt: usBundledFixes.properties.generatedAt,
          recordCount: usBundledFixes.properties.recordCount,
        },
        airways: {
          nasrCycleDate: usBundledAirways.properties.nasrCycleDate,
          generatedAt: usBundledAirways.properties.generatedAt,
          recordCount: usBundledAirways.properties.recordCount,
          waypointCount: usBundledAirways.properties.waypointCount,
        },
        procedures: {
          cifpCycleDate: usBundledProcedures.properties.cifpCycleDate,
          generatedAt: usBundledProcedures.properties.generatedAt,
          recordCount: usBundledProcedures.properties.recordCount,
          sidCount: usBundledProcedures.properties.sidCount,
          starCount: usBundledProcedures.properties.starCount,
          iapCount: usBundledProcedures.properties.iapCount,
          legCount: usBundledProcedures.properties.legCount,
        },
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
