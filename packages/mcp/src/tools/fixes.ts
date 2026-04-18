/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/fixes` fix/waypoint lookup methods,
 * backed by the US NASR snapshot in `@squawk/fix-data`.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FixSearchQuery, NearestFixQuery } from '@squawk/fixes';
import type { FixUseCode } from '@squawk/types';
import { z } from 'zod';
import { fixResolver } from '../resolvers.js';

/** All {@link FixUseCode} values, used for input validation. */
const FIX_USE_CODE_VALUES = [
  'WP',
  'RP',
  'MW',
  'MR',
  'CN',
  'VFR',
  'NRS',
  'RADAR',
] as const satisfies readonly FixUseCode[];

/**
 * Registers fix/waypoint lookup tools on the given MCP server. Uses the
 * shared {@link fixResolver} built at module load time.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerFixTools(server: McpServer): void {
  server.registerTool(
    'get_fix_by_ident',
    {
      title: 'Get fixes by identifier',
      description:
        'Looks up US fixes/waypoints by identifier (e.g. "MERIT", "BOSCO"). Multiple fixes can share the same identifier across ICAO regions, so the result is always an array. Returns an empty array when no match is found.',
      inputSchema: {
        ident: z.string().min(1).describe('Fix identifier (case-insensitive).'),
      },
    },
    ({ ident }) => {
      const fixes = fixResolver.byIdent(ident);
      return {
        content: [{ type: 'text', text: JSON.stringify(fixes, null, 2) }],
        structuredContent: { fixes },
      };
    },
  );

  server.registerTool(
    'find_nearest_fixes',
    {
      title: 'Find nearest fixes',
      description:
        'Finds US fixes/waypoints near a geographic position, sorted by great-circle distance in nautical miles.',
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
        useCodes: z
          .array(z.enum(FIX_USE_CODE_VALUES))
          .optional()
          .describe(
            'Restrict results to these FAA fix-use codes (e.g. WP=waypoint, RP=reporting point, VFR=VFR waypoint). Omit to include all use codes.',
          ),
      },
    },
    ({ lat, lon, maxDistanceNm, limit, useCodes }) => {
      const query: NearestFixQuery = { lat, lon };
      if (maxDistanceNm !== undefined) {
        query.maxDistanceNm = maxDistanceNm;
      }
      if (limit !== undefined) {
        query.limit = limit;
      }
      if (useCodes !== undefined) {
        query.useCodes = new Set(useCodes);
      }
      const results = fixResolver.nearest(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        structuredContent: { results },
      };
    },
  );

  server.registerTool(
    'search_fixes',
    {
      title: 'Search fixes by identifier',
      description:
        'Searches US fixes/waypoints by case-insensitive substring matching against the fix identifier. Results are returned in alphabetical order by identifier.',
      inputSchema: {
        text: z.string().min(1).describe('Substring to match against the fix identifier.'),
        useCodes: z
          .array(z.enum(FIX_USE_CODE_VALUES))
          .optional()
          .describe('Restrict results to these FAA fix-use codes. Omit to include all use codes.'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of results to return. Defaults to 20.'),
      },
    },
    ({ text, useCodes, limit }) => {
      const query: FixSearchQuery = { text };
      if (useCodes !== undefined) {
        query.useCodes = new Set(useCodes);
      }
      if (limit !== undefined) {
        query.limit = limit;
      }
      const fixes = fixResolver.search(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(fixes, null, 2) }],
        structuredContent: { fixes },
      };
    },
  );
}
