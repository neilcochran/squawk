/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/navaids` navaid lookup methods, backed
 * by the US NASR snapshot in `@squawk/navaid-data`.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NavaidFrequencyQuery, NavaidSearchQuery, NearestNavaidQuery } from '@squawk/navaids';
import type { NavaidType } from '@squawk/types';
import { z } from 'zod';
import { navaidResolver } from '../resolvers.js';

/** All {@link NavaidType} values, used for input validation. */
const NAVAID_TYPE_VALUES = [
  'VOR',
  'VORTAC',
  'VOR/DME',
  'TACAN',
  'DME',
  'NDB',
  'NDB/DME',
  'FAN_MARKER',
  'MARINE_NDB',
  'VOT',
] as const satisfies readonly NavaidType[];

/**
 * Registers navaid lookup tools on the given MCP server. Uses the shared
 * {@link navaidResolver} built at module load time.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerNavaidTools(server: McpServer): void {
  server.registerTool(
    'get_navaid_by_ident',
    {
      title: 'Get navaids by identifier',
      description:
        'Looks up US navaids by identifier (e.g. "BOS", "JFK"). Multiple navaids can share the same identifier (for example a co-located NDB and VOR), so the result is always an array. Returns an empty array when no match is found.',
      inputSchema: {
        ident: z.string().min(1).describe('Navaid identifier (case-insensitive).'),
      },
    },
    ({ ident }) => {
      const navaids = navaidResolver.byIdent(ident);
      return {
        content: [{ type: 'text', text: JSON.stringify(navaids, null, 2) }],
        structuredContent: { navaids },
      };
    },
  );

  server.registerTool(
    'find_navaids_by_frequency',
    {
      title: 'Find navaids by frequency',
      description:
        'Finds US navaids tuned to a given frequency. VOR-family navaids (VOR, VORTAC, VOR/DME, TACAN, DME, VOT) use MHz; NDB-family navaids (NDB, NDB/DME, MARINE_NDB) use kHz. Filter by navaid types when needed to disambiguate the unit.',
      inputSchema: {
        frequency: z
          .number()
          .positive()
          .describe('Frequency value (MHz for VOR-family, kHz for NDB-family).'),
        navaidTypes: z
          .array(z.enum(NAVAID_TYPE_VALUES))
          .optional()
          .describe('Restrict results to these navaid types. Omit to include all types.'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of results to return. Defaults to 20.'),
      },
    },
    ({ frequency, navaidTypes, limit }) => {
      const query: NavaidFrequencyQuery = { frequency };
      if (navaidTypes !== undefined) {
        query.types = new Set(navaidTypes);
      }
      if (limit !== undefined) {
        query.limit = limit;
      }
      const navaids = navaidResolver.byFrequency(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(navaids, null, 2) }],
        structuredContent: { navaids },
      };
    },
  );

  server.registerTool(
    'find_nearest_navaids',
    {
      title: 'Find nearest navaids',
      description:
        'Finds US navaids near a geographic position, sorted by great-circle distance in nautical miles.',
      inputSchema: {
        lat: z.number().min(-90).max(90).describe('Latitude in decimal degrees (WGS84).'),
        lon: z.number().min(-180).max(180).describe('Longitude in decimal degrees (WGS84).'),
        maxDistanceNm: z
          .number()
          .positive()
          .optional()
          .describe('Maximum search radius in nautical miles. Defaults to 30.'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of results to return. Defaults to 10.'),
        navaidTypes: z
          .array(z.enum(NAVAID_TYPE_VALUES))
          .optional()
          .describe('Restrict results to these navaid types. Omit to include all types.'),
      },
    },
    ({ lat, lon, maxDistanceNm, limit, navaidTypes }) => {
      const query: NearestNavaidQuery = { lat, lon };
      if (maxDistanceNm !== undefined) {
        query.maxDistanceNm = maxDistanceNm;
      }
      if (limit !== undefined) {
        query.limit = limit;
      }
      if (navaidTypes !== undefined) {
        query.types = new Set(navaidTypes);
      }
      const results = navaidResolver.nearest(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        structuredContent: { results },
      };
    },
  );

  server.registerTool(
    'search_navaids',
    {
      title: 'Search navaids by name or identifier',
      description:
        'Searches US navaids using case-insensitive substring matching against the navaid name and identifier. Results are returned in alphabetical order by name.',
      inputSchema: {
        text: z.string().min(1).describe('Substring to match against navaid name or identifier.'),
        navaidTypes: z
          .array(z.enum(NAVAID_TYPE_VALUES))
          .optional()
          .describe('Restrict results to these navaid types. Omit to include all types.'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of results to return. Defaults to 20.'),
      },
    },
    ({ text, navaidTypes, limit }) => {
      const query: NavaidSearchQuery = { text };
      if (navaidTypes !== undefined) {
        query.types = new Set(navaidTypes);
      }
      if (limit !== undefined) {
        query.limit = limit;
      }
      const navaids = navaidResolver.search(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(navaids, null, 2) }],
        structuredContent: { navaids },
      };
    },
  );
}
