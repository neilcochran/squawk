/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/procedures` SID/STAR lookup, filtering,
 * and expansion methods, backed by the US NASR snapshot in
 * `@squawk/procedure-data`.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProcedureSearchQuery } from '@squawk/procedures';
import type { ProcedureType } from '@squawk/types';
import { z } from 'zod';
import { procedureResolver } from '../resolvers.js';

/** All {@link ProcedureType} values, used for input validation. */
const PROCEDURE_TYPE_VALUES = ['SID', 'STAR'] as const satisfies readonly ProcedureType[];

/**
 * Registers SID/STAR procedure lookup tools on the given MCP server. Uses
 * the shared {@link procedureResolver} built at module load time.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerProcedureTools(server: McpServer): void {
  server.registerTool(
    'get_procedure_by_code',
    {
      title: 'Get procedure by FAA computer code',
      description:
        'Looks up a US instrument procedure (SID or STAR) by its FAA computer code (e.g. "AALLE4", "ACCRA5"). Returns null when no match is found.',
      inputSchema: {
        computerCode: z
          .string()
          .min(1)
          .describe('FAA computer code for the procedure (case-insensitive).'),
      },
    },
    ({ computerCode }) => {
      const procedure = procedureResolver.byName(computerCode);
      if (procedure === undefined) {
        return {
          content: [
            { type: 'text', text: `No procedure found with computer code "${computerCode}".` },
          ],
          structuredContent: { procedure: null },
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(procedure, null, 2) }],
        structuredContent: { procedure },
      };
    },
  );

  server.registerTool(
    'find_procedures_by_airport',
    {
      title: 'Find procedures associated with an airport',
      description:
        'Finds all US instrument procedures (SIDs and STARs) associated with a given airport identifier (FAA ID). Returns an empty array when no match is found.',
      inputSchema: {
        airportId: z.string().min(1).describe('Airport FAA identifier (case-insensitive).'),
      },
    },
    ({ airportId }) => {
      const procedures = procedureResolver.byAirport(airportId);
      return {
        content: [{ type: 'text', text: JSON.stringify(procedures, null, 2) }],
        structuredContent: { procedures },
      };
    },
  );

  server.registerTool(
    'expand_procedure',
    {
      title: 'Expand a procedure into a waypoint sequence',
      description:
        "Expands a procedure into an ordered waypoint sequence. Without a transition, returns the first common route. With a transition name, returns the matching transition's waypoints followed by the first common route's waypoints (with overlapping connecting fixes deduplicated). Returns null when the procedure or transition is not found.",
      inputSchema: {
        computerCode: z
          .string()
          .min(1)
          .describe('FAA computer code for the procedure (case-insensitive).'),
        transitionName: z
          .string()
          .min(1)
          .optional()
          .describe(
            'Optional transition name (typically the entry/exit fix identifier, case-insensitive). Omit to use the first common route.',
          ),
      },
    },
    ({ computerCode, transitionName }) => {
      const expansion = procedureResolver.expand(computerCode, transitionName);
      if (expansion === undefined) {
        return {
          content: [
            {
              type: 'text',
              text: `Could not expand procedure "${computerCode}"${transitionName ? ` with transition "${transitionName}"` : ''}.`,
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
    'search_procedures',
    {
      title: 'Search procedures by name or code',
      description:
        'Searches US instrument procedures by case-insensitive substring matching against both the procedure name and computer code. Results are returned in alphabetical order by computer code.',
      inputSchema: {
        text: z
          .string()
          .min(1)
          .describe('Substring to match against the procedure name or computer code.'),
        procedureType: z
          .enum(PROCEDURE_TYPE_VALUES)
          .optional()
          .describe('Restrict results to SIDs or STARs only. Omit to include both.'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of results to return. Defaults to 20.'),
      },
    },
    ({ text, procedureType, limit }) => {
      const query: ProcedureSearchQuery = { text };
      if (procedureType !== undefined) {
        query.type = procedureType;
      }
      if (limit !== undefined) {
        query.limit = limit;
      }
      const procedures = procedureResolver.search(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(procedures, null, 2) }],
        structuredContent: { procedures },
      };
    },
  );
}
