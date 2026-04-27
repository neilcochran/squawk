/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/airports` airport lookup methods, backed
 * by the US NASR snapshot in `@squawk/airport-data`. The dataset is loaded
 * and indexed eagerly when the shared {@link airportResolver} is imported.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AirportSearchQuery, NearestAirportQuery } from '@squawk/airports';
import type { FacilityType } from '@squawk/types';
import { z } from 'zod';
import { airportResolver } from '../resolvers.js';

/** All {@link FacilityType} values, used for input validation. */
const FACILITY_TYPE_VALUES = [
  'AIRPORT',
  'HELIPORT',
  'SEAPLANE_BASE',
  'GLIDERPORT',
  'ULTRALIGHT',
  'BALLOONPORT',
] as const satisfies readonly FacilityType[];

/**
 * Registers airport lookup tools (by FAA ID, by ICAO code, nearest, text
 * search) on the given MCP server. Tools share the {@link airportResolver}
 * singleton built at module load time from the bundled US NASR dataset.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerAirportTools(server: McpServer): void {
  const resolver = airportResolver;

  server.registerTool(
    'get_airport_by_faa_id',
    {
      title: 'Get airport by FAA identifier',
      description:
        'Looks up a US airport by its FAA location identifier (e.g. "JFK", "LAX", "3N6"). Returns the full airport record including runways, frequencies, and ILS data, or null if no match is found.',
      inputSchema: {
        faaId: z.string().min(1).describe('FAA location identifier (case-insensitive).'),
      },
    },
    ({ faaId }) => {
      const airport = resolver.byFaaId(faaId);
      if (airport === undefined) {
        return {
          content: [{ type: 'text', text: `No airport found with FAA ID "${faaId}".` }],
          structuredContent: { airport: null },
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(airport, null, 2) }],
        structuredContent: { airport },
      };
    },
  );

  server.registerTool(
    'get_airport_by_icao',
    {
      title: 'Get airport by ICAO code',
      description:
        'Looks up a US airport by its ICAO code (e.g. "KJFK", "KLAX"). Returns the full airport record including runways, frequencies, and ILS data, or null if no match is found.',
      inputSchema: {
        icao: z.string().min(1).describe('ICAO airport code (case-insensitive).'),
      },
    },
    ({ icao }) => {
      const airport = resolver.byIcao(icao);
      if (airport === undefined) {
        return {
          content: [{ type: 'text', text: `No airport found with ICAO code "${icao}".` }],
          structuredContent: { airport: null },
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(airport, null, 2) }],
        structuredContent: { airport },
      };
    },
  );

  server.registerTool(
    'find_nearest_airports',
    {
      title: 'Find nearest airports',
      description:
        'Finds US airports near a geographic position, sorted by great-circle distance in nautical miles. Supports filtering by facility type and minimum runway length.',
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
        facilityTypes: z
          .array(z.enum(FACILITY_TYPE_VALUES))
          .optional()
          .describe('Restrict results to these facility types. Omit to include all types.'),
        minRunwayLengthFt: z
          .number()
          .positive()
          .optional()
          .describe('Only include airports with at least one runway meeting this length in feet.'),
      },
    },
    ({ lat, lon, maxDistanceNm, limit, facilityTypes, minRunwayLengthFt }) => {
      const query: NearestAirportQuery = { lat, lon };
      if (maxDistanceNm !== undefined) {
        query.maxDistanceNm = maxDistanceNm;
      }
      if (limit !== undefined) {
        query.limit = limit;
      }
      if (facilityTypes !== undefined) {
        query.types = new Set(facilityTypes);
      }
      if (minRunwayLengthFt !== undefined) {
        query.minRunwayLengthFt = minRunwayLengthFt;
      }
      const results = resolver.nearest(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        structuredContent: { results },
      };
    },
  );

  server.registerTool(
    'search_airports',
    {
      title: 'Search airports by name or city',
      description:
        'Searches US airports using case-insensitive substring matching on airport name and city. Returns airports in alphabetical order by name. Use this when the user knows a partial name but not the identifier.',
      inputSchema: {
        text: z.string().min(1).describe('Substring to match against airport name or city.'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of results to return. Defaults to 20.'),
        facilityTypes: z
          .array(z.enum(FACILITY_TYPE_VALUES))
          .optional()
          .describe('Restrict results to these facility types. Omit to include all types.'),
      },
    },
    ({ text, limit, facilityTypes }) => {
      const query: AirportSearchQuery = { text };
      if (limit !== undefined) {
        query.limit = limit;
      }
      if (facilityTypes !== undefined) {
        query.types = new Set(facilityTypes);
      }
      const results = resolver.search(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        structuredContent: { results },
      };
    },
  );
}
