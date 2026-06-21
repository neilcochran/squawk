/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/fixes` fix/waypoint lookup methods,
 * backed by the US NASR snapshot in `@squawk/fix-data`.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { FixSearchQuery, NearestFixQuery } from '@squawk/fixes';
import type { FixUseCode } from '@squawk/types';

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
    'get_fix_by_ident_at_position',
    {
      title: 'Get fix by identifier nearest a position',
      description:
        'Looks up the single US fix/waypoint sharing the given identifier that lies nearest to a geographic position. The same fix identifier can be published in more than one ICAO region; this disambiguates the collision by proximity to a known point such as a map-click location or an adjacent route waypoint. When toleranceNm is provided, matches farther than that distance are excluded and the result is null; when omitted, the nearest match wins regardless of distance. Returns null when no fix carries the identifier.',
      inputSchema: {
        ident: z.string().min(1).describe('Fix identifier (case-insensitive).'),
        lat: z
          .number()
          .min(-90)
          .max(90)
          .describe('Latitude of the reference position in decimal degrees (WGS84).'),
        lon: z
          .number()
          .min(-180)
          .max(180)
          .describe('Longitude of the reference position in decimal degrees (WGS84).'),
        toleranceNm: z
          .number()
          .positive()
          .optional()
          .describe(
            'Maximum great-circle distance in nautical miles. Omit to let the nearest match win regardless of distance.',
          ),
      },
    },
    ({ ident, lat, lon, toleranceNm }) => {
      const fix = fixResolver.byIdentAtPosition(ident, lat, lon, toleranceNm) ?? null;
      return {
        content: [{ type: 'text', text: JSON.stringify(fix, null, 2) }],
        structuredContent: { fix },
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
        'Fuzzy-searches US fixes/waypoints by identifier. Matching is case-insensitive and tolerant of prefixes, substrings, subsequences, and small typos. Each result carries a match score in [0, 1] (1 is an exact match); results are returned best-match first.',
      inputSchema: {
        text: z
          .string()
          .min(1)
          .describe('Search text, fuzzily matched against the fix identifier.'),
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
        minScore: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe(
            'Minimum match score (exclusive) in [0, 1] a result must reach. Defaults to 0. Raise it to drop weak fuzzy matches.',
          ),
      },
    },
    ({ text, useCodes, limit, minScore }) => {
      const query: FixSearchQuery = { text };
      if (useCodes !== undefined) {
        query.useCodes = new Set(useCodes);
      }
      if (limit !== undefined) {
        query.limit = limit;
      }
      if (minScore !== undefined) {
        query.minScore = minScore;
      }
      const fixes = fixResolver.search(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(fixes, null, 2) }],
        structuredContent: { fixes },
      };
    },
  );
}
