/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/airspace` queries (point-in-airspace and
 * per-airport lookups), backed by the US NASR airspace GeoJSON snapshot in
 * `@squawk/airspace-data`.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AirspaceQuery } from '@squawk/airspace';
import type { AirspaceFeature, AirspaceType } from '@squawk/types';
import { z } from 'zod';
import { airportResolver, airspaceResolver } from '../resolvers.js';

/** All {@link AirspaceType} values, used for input validation. */
const AIRSPACE_TYPE_VALUES = [
  'CLASS_B',
  'CLASS_C',
  'CLASS_D',
  'CLASS_E2',
  'CLASS_E3',
  'CLASS_E4',
  'CLASS_E5',
  'CLASS_E6',
  'CLASS_E7',
  'MOA',
  'RESTRICTED',
  'PROHIBITED',
  'WARNING',
  'ALERT',
  'NSA',
] as const satisfies readonly AirspaceType[];

/**
 * Strips the polygon boundary from a feature for tool output. The boundary
 * coordinates are dropped because a single Class B feature can carry hundreds
 * of vertices, and the MCP client almost always wants the descriptive metadata
 * (type, identifier, vertical bounds, controlling facility) rather than the
 * raw geometry. The structured-content schema preserves a `vertexCount` so
 * callers can tell how detailed the original boundary was.
 */
function summarizeFeature(feature: AirspaceFeature): {
  /** Airspace class or SUA designation. */
  type: AirspaceType;
  /** Human-readable airspace name. */
  name: string;
  /** NASR designator (SUA) or associated airport identifier (Class B/C/D). */
  identifier: string;
  /** Lower vertical bound. */
  floor: AirspaceFeature['floor'];
  /** Upper vertical bound. */
  ceiling: AirspaceFeature['ceiling'];
  /** Two-letter US state or territory abbreviation, or null. */
  state: string | null;
  /** Controlling facility/agency, or null. */
  controllingFacility: string | null;
  /** Operating schedule text, or null. */
  scheduleDescription: string | null;
  /** Number of vertices in the boundary polygon (useful for downstream tooling). */
  vertexCount: number;
} {
  const ring = feature.boundary.coordinates[0] ?? [];
  return {
    type: feature.type,
    name: feature.name,
    identifier: feature.identifier,
    floor: feature.floor,
    ceiling: feature.ceiling,
    state: feature.state,
    controllingFacility: feature.controllingFacility,
    scheduleDescription: feature.scheduleDescription,
    vertexCount: ring.length,
  };
}

/**
 * Registers airspace query tools on the given MCP server. The bundled US
 * airspace GeoJSON snapshot is decoded and indexed eagerly via the shared
 * {@link airspaceResolver}.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerAirspaceTools(server: McpServer): void {
  server.registerTool(
    'query_airspace_at_position',
    {
      title: 'Query airspace at a position and altitude',
      description:
        'Returns every US airspace feature whose lateral polygon contains the given position and whose vertical bounds contain the given altitude (feet MSL). Covers Class B/C/D/E controlled airspace and Special Use Airspace (MOA, restricted, prohibited, warning, alert, NSA). The boundary polygon is summarized as a vertex count to keep responses compact - call this tool with multiple altitudes to walk a vertical profile.',
      inputSchema: {
        lat: z.number().min(-90).max(90).describe('Latitude in decimal degrees (WGS84).'),
        lon: z.number().min(-180).max(180).describe('Longitude in decimal degrees (WGS84).'),
        altitudeFt: z
          .number()
          .describe('Altitude in feet MSL to compare against airspace vertical bounds.'),
        airspaceTypes: z
          .array(z.enum(AIRSPACE_TYPE_VALUES))
          .optional()
          .describe('Restrict results to these airspace types. Omit to include all types.'),
      },
    },
    ({ lat, lon, altitudeFt, airspaceTypes }) => {
      const query: AirspaceQuery = { lat, lon, altitudeFt };
      if (airspaceTypes !== undefined) {
        query.types = new Set(airspaceTypes);
      }
      const features = airspaceResolver.query(query).map(summarizeFeature);
      return {
        content: [{ type: 'text', text: JSON.stringify(features, null, 2) }],
        structuredContent: { features },
      };
    },
  );

  server.registerTool(
    'get_airspace_for_airport',
    {
      title: 'Get airspace features associated with an airport',
      description:
        'Returns every airspace feature associated with a given airport (Class B/C/D/E2 surface-area sectors), each with full polygon boundary coordinates suitable for drawing. Accepts either an FAA location identifier (e.g. "JFK", "LAX") or an ICAO code (e.g. "KJFK", "KLAX"); ICAO codes are resolved to the underlying FAA ID before lookup. Unlike query_airspace_at_position, boundary geometry is preserved so callers can render the full "wedding cake" of shells, and no altitude is needed. Returns an empty features array for airports with no surrounding controlled airspace (most GA fields).',
      inputSchema: {
        airportId: z
          .string()
          .min(1)
          .describe('FAA location identifier or ICAO code (case-insensitive).'),
        airspaceTypes: z
          .array(z.enum(AIRSPACE_TYPE_VALUES))
          .optional()
          .describe(
            'Restrict results to these airspace types. Defaults to surface-area classes (CLASS_B, CLASS_C, CLASS_D, CLASS_E2).',
          ),
      },
    },
    ({ airportId, airspaceTypes }) => {
      const airport = airportResolver.byFaaId(airportId) ?? airportResolver.byIcao(airportId);
      if (airport === undefined) {
        return {
          content: [{ type: 'text', text: `No airport found for identifier "${airportId}".` }],
          structuredContent: { airport: null, features: [] },
        };
      }
      const typeFilter =
        airspaceTypes === undefined
          ? new Set<AirspaceType>(['CLASS_B', 'CLASS_C', 'CLASS_D', 'CLASS_E2'])
          : new Set<AirspaceType>(airspaceTypes);
      const features = airspaceResolver.byAirport(airport.faaId, typeFilter);
      return {
        content: [{ type: 'text', text: JSON.stringify({ airport, features }, null, 2) }],
        structuredContent: { airport, features },
      };
    },
  );
}
