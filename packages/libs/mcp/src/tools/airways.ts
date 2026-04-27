/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/airways` airway lookup, traversal, and
 * expansion methods, backed by the US NASR snapshot in `@squawk/airway-data`.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AirwaySearchQuery } from '@squawk/airways';
import type { AirwayType } from '@squawk/types';
import { z } from 'zod';
import { airwayResolver } from '../resolvers.js';

/** All {@link AirwayType} values, used for input validation. */
const AIRWAY_TYPE_VALUES = [
  'VICTOR',
  'JET',
  'RNAV_Q',
  'RNAV_T',
  'GREEN',
  'RED',
  'AMBER',
  'BLUE',
  'ATLANTIC',
  'BAHAMA',
  'PACIFIC',
  'PUERTO_RICO',
] as const satisfies readonly AirwayType[];

/**
 * Registers airway lookup tools on the given MCP server. Uses the shared
 * {@link airwayResolver} built at module load time.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerAirwayTools(server: McpServer): void {
  server.registerTool(
    'get_airway_by_designation',
    {
      title: 'Get airways by designation',
      description:
        'Looks up US airways by designation (e.g. "V16", "J60", "Q1"). Multiple airways can share the same designation across regions (for example V16 exists in both the contiguous US and Hawaii), so the result is always an array. Returns an empty array when no match is found.',
      inputSchema: {
        designation: z.string().min(1).describe('Airway designation (case-insensitive).'),
      },
    },
    ({ designation }) => {
      const airways = airwayResolver.byDesignation(designation);
      return {
        content: [{ type: 'text', text: JSON.stringify(airways, null, 2) }],
        structuredContent: { airways },
      };
    },
  );

  server.registerTool(
    'expand_airway_segment',
    {
      title: 'Expand an airway between two fixes',
      description:
        'Expands an airway between two fixes, returning the ordered sequence of waypoints from the entry fix to the exit fix (inclusive). Airways can be traversed in either direction. Returns null if the entry/exit fixes are not found on the airway.',
      inputSchema: {
        designation: z.string().min(1).describe('Airway designation (case-insensitive).'),
        entryFix: z.string().min(1).describe('Identifier of the entry fix (case-insensitive).'),
        exitFix: z.string().min(1).describe('Identifier of the exit fix (case-insensitive).'),
      },
    },
    ({ designation, entryFix, exitFix }) => {
      const expansion = airwayResolver.expand(designation, entryFix, exitFix);
      if (expansion === undefined) {
        return {
          content: [
            {
              type: 'text',
              text: `Could not expand airway "${designation}" from "${entryFix}" to "${exitFix}".`,
            },
          ],
          structuredContent: { expansion: null },
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(expansion, null, 2) }],
        structuredContent: { expansion },
      };
    },
  );

  server.registerTool(
    'find_airways_by_fix',
    {
      title: 'Find airways through a fix',
      description:
        'Finds all US airways that pass through a given fix, navaid, or waypoint identifier. Each result includes the airway record and the waypoint index where the identifier appears in the airway sequence.',
      inputSchema: {
        ident: z
          .string()
          .min(1)
          .describe('Fix, navaid, or waypoint identifier (case-insensitive).'),
      },
    },
    ({ ident }) => {
      const results = airwayResolver.byFix(ident);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        structuredContent: { results },
      };
    },
  );

  server.registerTool(
    'search_airways',
    {
      title: 'Search airways by designation',
      description:
        'Searches US airways by case-insensitive substring matching against the airway designation. Results are returned in alphabetical order by designation.',
      inputSchema: {
        text: z.string().min(1).describe('Substring to match against the airway designation.'),
        airwayTypes: z
          .array(z.enum(AIRWAY_TYPE_VALUES))
          .optional()
          .describe('Restrict results to these airway types. Omit to include all types.'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of results to return. Defaults to 20.'),
      },
    },
    ({ text, airwayTypes, limit }) => {
      const query: AirwaySearchQuery = { text };
      if (airwayTypes !== undefined) {
        query.types = new Set(airwayTypes);
      }
      if (limit !== undefined) {
        query.limit = limit;
      }
      const airways = airwayResolver.search(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(airways, null, 2) }],
        structuredContent: { airways },
      };
    },
  );
}
