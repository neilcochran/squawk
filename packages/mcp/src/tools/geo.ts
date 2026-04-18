/**
 * @packageDocumentation
 * MCP tool module wrapping the great-circle geometry utilities from
 * `@squawk/geo`. Tools take plain lat/lon inputs and return distances in
 * nautical miles and bearings in degrees true.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { greatCircle } from '@squawk/geo';
import { z } from 'zod';

/** Reusable zod fragment describing a latitude input. */
const latFragment = z
  .number()
  .min(-90)
  .max(90)
  .describe('Latitude in decimal degrees (WGS84, positive north).');

/** Reusable zod fragment describing a longitude input. */
const lonFragment = z
  .number()
  .min(-180)
  .max(180)
  .describe('Longitude in decimal degrees (WGS84, positive east).');

/**
 * Registers great-circle geometry tools (distance, bearing, midpoint,
 * destination-point) on the given MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerGeoTools(server: McpServer): void {
  server.registerTool(
    'great_circle_distance',
    {
      title: 'Great-circle distance',
      description:
        'Computes the great-circle distance between two geographic positions in nautical miles using the Haversine formula on a spherical Earth.',
      inputSchema: {
        lat1: latFragment,
        lon1: lonFragment,
        lat2: latFragment,
        lon2: lonFragment,
      },
    },
    ({ lat1, lon1, lat2, lon2 }) => {
      const distanceNm = greatCircle.distanceNm(lat1, lon1, lat2, lon2);
      return {
        content: [{ type: 'text', text: `${distanceNm.toFixed(2)} nm` }],
        structuredContent: { distanceNm },
      };
    },
  );

  server.registerTool(
    'great_circle_bearing',
    {
      title: 'Great-circle initial bearing',
      description:
        'Computes the initial great-circle bearing (degrees true, 0-360) from the first position to the second.',
      inputSchema: {
        lat1: latFragment,
        lon1: lonFragment,
        lat2: latFragment,
        lon2: lonFragment,
      },
    },
    ({ lat1, lon1, lat2, lon2 }) => {
      const bearingDeg = greatCircle.bearing(lat1, lon1, lat2, lon2);
      return {
        content: [{ type: 'text', text: `${bearingDeg.toFixed(1)} deg true` }],
        structuredContent: { bearingDeg },
      };
    },
  );

  server.registerTool(
    'great_circle_bearing_and_distance',
    {
      title: 'Great-circle bearing and distance',
      description:
        'Computes the initial great-circle bearing (degrees true, 0-360) and distance (nautical miles) from the first position to the second in one call.',
      inputSchema: {
        lat1: latFragment,
        lon1: lonFragment,
        lat2: latFragment,
        lon2: lonFragment,
      },
    },
    ({ lat1, lon1, lat2, lon2 }) => {
      const { bearingDeg, distanceNm } = greatCircle.bearingAndDistance(lat1, lon1, lat2, lon2);
      return {
        content: [
          {
            type: 'text',
            text: `${bearingDeg.toFixed(1)} deg true, ${distanceNm.toFixed(2)} nm`,
          },
        ],
        structuredContent: { bearingDeg, distanceNm },
      };
    },
  );

  server.registerTool(
    'great_circle_midpoint',
    {
      title: 'Great-circle midpoint',
      description:
        'Computes the midpoint along the great-circle arc between two geographic positions.',
      inputSchema: {
        lat1: latFragment,
        lon1: lonFragment,
        lat2: latFragment,
        lon2: lonFragment,
      },
    },
    ({ lat1, lon1, lat2, lon2 }) => {
      const { lat, lon } = greatCircle.midpoint(lat1, lon1, lat2, lon2);
      return {
        content: [
          {
            type: 'text',
            text: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
          },
        ],
        structuredContent: { lat, lon },
      };
    },
  );

  server.registerTool(
    'great_circle_destination',
    {
      title: 'Great-circle destination point',
      description:
        'Computes the destination point reached by traveling a given distance (nautical miles) along a bearing (degrees true) from a starting position.',
      inputSchema: {
        lat: latFragment,
        lon: lonFragment,
        bearingDeg: z
          .number()
          .describe('Initial bearing in degrees true. Values outside [0, 360) are normalized.'),
        travelDistanceNm: z
          .number()
          .describe(
            'Distance to travel along the bearing in nautical miles. Negative values reverse direction.',
          ),
      },
    },
    ({ lat, lon, bearingDeg, travelDistanceNm }) => {
      const destination = greatCircle.destination(lat, lon, bearingDeg, travelDistanceNm);
      return {
        content: [
          {
            type: 'text',
            text: `${destination.lat.toFixed(6)}, ${destination.lon.toFixed(6)}`,
          },
        ],
        structuredContent: { lat: destination.lat, lon: destination.lon },
      };
    },
  );
}
