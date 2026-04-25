/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/airspace` queries (point-in-airspace and
 * per-airport lookups), backed by the US NASR airspace GeoJSON snapshot in
 * `@squawk/airspace-data`.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AirspaceQuery } from '@squawk/airspace';
import type { AirspaceFeature, AirspaceType, ArtccStratum } from '@squawk/types';
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
  'ARTCC',
] as const satisfies readonly AirspaceType[];

/** All {@link ArtccStratum} values, used for input validation. */
const ARTCC_STRATUM_VALUES = [
  'LOW',
  'HIGH',
  'UTA',
  'CTA',
  'FIR',
  'CTA/FIR',
] as const satisfies readonly ArtccStratum[];

/**
 * Strips the polygon boundary from a feature for tool output. The boundary
 * coordinates are dropped because a single Class B feature can carry hundreds
 * of vertices, and the MCP client almost always wants the descriptive metadata
 * (type, identifier, vertical bounds, controlling facility) rather than the
 * raw geometry. The structured-content schema preserves a `vertexCount` so
 * callers can tell how detailed the original boundary was.
 */
function summarizeFeature(feature: AirspaceFeature): {
  /** Airspace class, SUA, or ARTCC designation. */
  type: AirspaceType;
  /** Human-readable airspace name. */
  name: string;
  /** NASR designator (SUA), associated airport identifier (Class B/C/D), or ARTCC code. */
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
  /** For ARTCC features, the stratum (LOW, HIGH, UTA, CTA, FIR, CTA/FIR); null for all other types. */
  artccStratum: ArtccStratum | null;
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
    artccStratum: feature.artccStratum,
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

  server.registerTool(
    'find_artcc_for_position',
    {
      title: 'Find the ARTCC center containing a position and altitude',
      description:
        'Returns the US Air Route Traffic Control Center (ARTCC) features whose lateral boundary contains the given position at the given altitude. Typically returns a single feature (one center, one stratum), but can return multiple in three cases: (1) oceanic positions covered by overlapping CTA and FIR strata; (2) positions exactly at a stratum boundary (e.g. FL180 matches both LOW and HIGH); (3) antimeridian-split centers like ZAK where a stratum is published as multiple sub-polygons that each cover part of the same geographic area. If the position falls outside any US ARTCC, returns an empty features array. Boundary geometry is summarized as a vertex count to keep responses compact - use find_artcc_by_identifier to retrieve full polygons.',
      inputSchema: {
        lat: z.number().min(-90).max(90).describe('Latitude in decimal degrees (WGS84).'),
        lon: z.number().min(-180).max(180).describe('Longitude in decimal degrees (WGS84).'),
        altitudeFt: z
          .number()
          .optional()
          .describe(
            'Altitude in feet MSL. Defaults to 0 (surface), which selects the LOW stratum where applicable. Pass FL180+ to target HIGH or FL600+ to target UTA.',
          ),
      },
    },
    ({ lat, lon, altitudeFt }) => {
      const query: AirspaceQuery = {
        lat,
        lon,
        altitudeFt: altitudeFt ?? 0,
        types: new Set<AirspaceType>(['ARTCC']),
      };
      const features = airspaceResolver.query(query).map(summarizeFeature);
      return {
        content: [{ type: 'text', text: JSON.stringify({ features }, null, 2) }],
        structuredContent: { features },
      };
    },
  );

  server.registerTool(
    'find_artcc_by_identifier',
    {
      title: 'Find ARTCC features for a center identifier',
      description:
        'Returns every ARTCC feature for the given three-letter center code (e.g. "ZNY", "ZBW", "ZAK"), with full polygon boundary coordinates suitable for drawing. Each US center is published as multiple features (one per stratum: LOW, HIGH, plus oceanic UTA/CTA/FIR), all returned by default. A single stratum can map to more than one feature when the source data has multiple disjoint shapes (e.g. ZOA UTA spans four oceanic delegation areas) or when antimeridian-crossing shapes are split into eastern and western sub-polygons (ZAK and ZAP). Pass a stratum filter to narrow results. Lookup is case-insensitive. Returns an empty features array for unknown identifiers.',
      inputSchema: {
        artccId: z
          .string()
          .min(3)
          .max(3)
          .describe('Three-letter ARTCC center code (e.g. "ZNY", "ZBW").'),
        stratum: z
          .enum(ARTCC_STRATUM_VALUES)
          .optional()
          .describe(
            'Restrict to a single stratum (LOW, HIGH, UTA, CTA, FIR, or CTA/FIR). Omit to return every published stratum for the center.',
          ),
      },
    },
    ({ artccId, stratum }) => {
      const features = airspaceResolver.byArtcc(artccId, stratum);
      return {
        content: [{ type: 'text', text: JSON.stringify({ features }, null, 2) }],
        structuredContent: { features },
      };
    },
  );
}
