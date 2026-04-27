/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/procedures` SID / STAR / IAP lookup,
 * filtering, and expansion methods, backed by the FAA CIFP snapshot in
 * `@squawk/procedure-data`.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProcedureSearchQuery } from '@squawk/procedures';
import type { ApproachType, ProcedureType } from '@squawk/types';
import { z } from 'zod';
import { procedureResolver } from '../resolvers.js';

/** All {@link ProcedureType} values, used for input validation. */
const PROCEDURE_TYPE_VALUES = ['SID', 'STAR', 'IAP'] as const satisfies readonly ProcedureType[];

/** All {@link ApproachType} values, used for input validation. */
const APPROACH_TYPE_VALUES = [
  'ILS',
  'LOC',
  'LOC_BC',
  'RNAV',
  'RNAV_RNP',
  'VOR',
  'VOR_DME',
  'NDB',
  'NDB_DME',
  'TACAN',
  'GLS',
  'IGS',
  'LDA',
  'SDF',
  'GPS',
  'FMS',
  'MLS',
] as const satisfies readonly ApproachType[];

/**
 * Registers procedure lookup tools (SIDs, STARs, and IAPs) on the given
 * MCP server. Uses the shared {@link procedureResolver} built at module
 * load time from the bundled FAA CIFP snapshot.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerProcedureTools(server: McpServer): void {
  server.registerTool(
    'find_procedures_by_identifier',
    {
      title: 'Find procedures by CIFP identifier',
      description:
        'Looks up every US instrument procedure (SID, STAR, or IAP) whose CIFP identifier matches (case-insensitive). The same identifier is often published at multiple airports (e.g. the approach "I04L" exists at any airport with an ILS 04L), so this returns all matches. Returns an empty array when no match is found.',
      inputSchema: {
        identifier: z
          .string()
          .min(1)
          .describe(
            'CIFP procedure identifier (case-insensitive). Examples: "AALLE4", "NUBLE4", "I04L", "R13".',
          ),
      },
    },
    ({ identifier }) => {
      const procedures = procedureResolver.byIdentifier(identifier);
      return {
        content: [{ type: 'text', text: JSON.stringify(procedures, null, 2) }],
        structuredContent: { procedures },
      };
    },
  );

  server.registerTool(
    'get_procedure_by_airport_and_identifier',
    {
      title: 'Get a specific procedure at an airport',
      description:
        'Looks up a single US instrument procedure at a specific airport by CIFP identifier. Use this when the same procedure identifier is published at multiple airports and the caller knows which airport is intended. Returns null when no match is found.',
      inputSchema: {
        airportId: z
          .string()
          .min(1)
          .describe('Airport identifier (ICAO or FAA, case-insensitive).'),
        identifier: z.string().min(1).describe('CIFP procedure identifier (case-insensitive).'),
      },
    },
    ({ airportId, identifier }) => {
      const procedure = procedureResolver.byAirportAndIdentifier(airportId, identifier);
      if (procedure === undefined) {
        return {
          content: [
            {
              type: 'text',
              text: `No procedure with identifier "${identifier}" found at "${airportId}".`,
            },
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
        'Finds all US instrument procedures (SIDs, STARs, and IAPs) associated with a given airport identifier. Returns an empty array when no match is found.',
      inputSchema: {
        airportId: z.string().min(1).describe('Airport identifier (case-insensitive).'),
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
    'find_procedures_by_airport_and_runway',
    {
      title: 'Find procedures serving a runway at an airport',
      description:
        'Finds procedures at an airport that serve a specific runway. Matches IAPs whose runway field equals the runway, and SIDs/STARs with a runway transition named "RW<runway>" (for example "RW04L"). Returns an empty array when no match is found.',
      inputSchema: {
        airportId: z.string().min(1).describe('Airport identifier (case-insensitive).'),
        runway: z
          .string()
          .min(1)
          .describe('Runway identifier, without the "RW" prefix (e.g. "04L", "13", "27R").'),
      },
    },
    ({ airportId, runway }) => {
      const procedures = procedureResolver.byAirportAndRunway(airportId, runway);
      return {
        content: [{ type: 'text', text: JSON.stringify(procedures, null, 2) }],
        structuredContent: { procedures },
      };
    },
  );

  server.registerTool(
    'find_approaches_by_type',
    {
      title: 'Find approaches by approach type',
      description:
        'Returns every Instrument Approach Procedure of a given approach classification (ILS, LOC, RNAV, VOR, NDB, etc.).',
      inputSchema: {
        approachType: z
          .enum(APPROACH_TYPE_VALUES)
          .describe('Approach classification. Use LOC_BC for localizer back-course approaches.'),
      },
    },
    ({ approachType }) => {
      const procedures = procedureResolver.byApproachType(approachType);
      return {
        content: [{ type: 'text', text: JSON.stringify(procedures, null, 2) }],
        structuredContent: { procedures },
      };
    },
  );

  server.registerTool(
    'expand_procedure',
    {
      title: 'Expand a procedure into an ordered leg sequence',
      description:
        "Expands a procedure at an airport into an ordered leg sequence. Without a transition name, returns the procedure's common route. With a transition name, merges the named transition's legs with the common route in flying order (SID: common then transition for enroute exits, transition then common for runway transitions; STAR: transition then common for enroute entries; IAP: approach transition then final approach segment). Returns null when the airport, procedure, or transition is not found.",
      inputSchema: {
        airportId: z.string().min(1).describe('Airport identifier (case-insensitive).'),
        identifier: z.string().min(1).describe('CIFP procedure identifier (case-insensitive).'),
        transitionName: z
          .string()
          .min(1)
          .optional()
          .describe('Optional transition name. Omit to return just the common route.'),
      },
    },
    ({ airportId, identifier, transitionName }) => {
      const expansion = procedureResolver.expand(airportId, identifier, transitionName);
      if (expansion === undefined) {
        return {
          content: [
            {
              type: 'text',
              text: `Could not expand procedure "${identifier}" at "${airportId}"${transitionName ? ` with transition "${transitionName}"` : ''}.`,
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
      title: 'Search procedures by name or identifier',
      description:
        'Searches US instrument procedures (SIDs, STARs, IAPs) by case-insensitive substring matching against both the procedure name and identifier. Results are returned sorted by airport and identifier.',
      inputSchema: {
        text: z
          .string()
          .min(1)
          .describe('Substring to match against the procedure name or identifier.'),
        procedureType: z
          .enum(PROCEDURE_TYPE_VALUES)
          .optional()
          .describe('Restrict results to SIDs, STARs, or IAPs only. Omit to include all types.'),
        approachType: z
          .enum(APPROACH_TYPE_VALUES)
          .optional()
          .describe('Restrict results to IAPs of a given approach classification.'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of results to return. Defaults to 20.'),
      },
    },
    ({ text, procedureType, approachType, limit }) => {
      const query: ProcedureSearchQuery = { text };
      if (procedureType !== undefined) {
        query.type = procedureType;
      }
      if (approachType !== undefined) {
        query.approachType = approachType;
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
