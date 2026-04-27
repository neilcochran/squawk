/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/icao-registry` aircraft registration
 * lookup, backed by the FAA ReleasableAircraft snapshot in
 * `@squawk/icao-registry-data`.
 *
 * Unlike the other domain modules, the registry data is loaded lazily on the
 * first tool invocation through {@link getIcaoRegistry}. The bundled data
 * package decompresses ~40 MB of records on import, which is wasteful for
 * sessions that never look up an aircraft.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getIcaoRegistry } from '../resolvers.js';

/** Pattern matching a valid 24-bit ICAO hex address (1-6 hex digits). */
const ICAO_HEX_PATTERN = /^[0-9A-Fa-f]{1,6}$/;

/**
 * Registers ICAO aircraft registration lookup tools on the given MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerIcaoRegistryTools(server: McpServer): void {
  server.registerTool(
    'lookup_aircraft_by_icao_hex',
    {
      title: 'Look up an aircraft by ICAO hex address',
      description:
        'Looks up a US-registered aircraft by its 24-bit ICAO hex address (the same identifier transmitted by Mode S and ADS-B). Returns registration, make, model, operator, aircraft type, engine type, and year of manufacture when known. Returns null when no match is found. The first call may take a few hundred milliseconds while the bundled FAA registration snapshot decompresses.',
      inputSchema: {
        icaoHex: z
          .string()
          .regex(ICAO_HEX_PATTERN, '1-6 hex digits (e.g. "AC82EC", "A4B5F2")')
          .describe('24-bit ICAO hex address (1-6 hex digits, case-insensitive).'),
      },
    },
    async ({ icaoHex }) => {
      const registry = await getIcaoRegistry();
      const aircraft = registry.lookup(icaoHex);
      if (aircraft === undefined) {
        return {
          content: [{ type: 'text', text: `No aircraft found for ICAO hex "${icaoHex}".` }],
          structuredContent: { aircraft: null },
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(aircraft, null, 2) }],
        structuredContent: { aircraft },
      };
    },
  );
}
