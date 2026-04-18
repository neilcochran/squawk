/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/flightplan` route-string parsing and
 * great-circle distance computation. The flightplan resolver composes the
 * shared airport, navaid, fix, airway, and procedure resolvers from
 * {@link ../resolvers.js}.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { computeRouteDistance, createFlightplanResolver } from '@squawk/flightplan';
import { z } from 'zod';
import {
  airportResolver,
  airwayResolver,
  fixResolver,
  navaidResolver,
  procedureResolver,
} from '../resolvers.js';

/**
 * Registers flight plan parsing and route distance tools on the given MCP
 * server. The flightplan resolver is built once at registration time and
 * shares the bundled NASR data via the resolver singletons.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerFlightplanTools(server: McpServer): void {
  const resolver = createFlightplanResolver({
    airports: airportResolver,
    navaids: navaidResolver,
    fixes: fixResolver,
    airways: airwayResolver,
    procedures: procedureResolver,
  });

  server.registerTool(
    'parse_flightplan_route',
    {
      title: 'Parse a flight plan route string',
      description:
        'Parses a whitespace-separated flight plan route string (e.g. "KJFK DCT MERIT J60 MARTN DCT KLAX") into structured route elements. Each token is classified as an airport, SID, STAR, airway, direct (DCT), waypoint, lat/lon coordinate, speed/altitude group, or unresolved. Airway tokens are expanded into waypoint sequences between the entry and exit fixes, and SID/STAR tokens are expanded into their first common route.',
      inputSchema: {
        routeString: z
          .string()
          .min(1)
          .describe('Whitespace-separated route string in ICAO Item 15 conventions.'),
      },
    },
    ({ routeString }) => {
      const route = resolver.parse(routeString);
      return {
        content: [{ type: 'text', text: JSON.stringify(route, null, 2) }],
        structuredContent: { route },
      };
    },
  );

  server.registerTool(
    'compute_route_distance',
    {
      title: 'Compute route distance and ETE',
      description:
        'Parses a flight plan route string and computes the total great-circle distance in nautical miles, the ordered list of legs with cumulative distance, and (when groundSpeedKt is supplied) the estimated time enroute in hours. Uses FAA-published per-segment distances on airway segments when available; otherwise falls back to great-circle computation. Unresolved tokens are surfaced separately so the caller can decide whether to trust the total.',
      inputSchema: {
        routeString: z
          .string()
          .min(1)
          .describe('Whitespace-separated route string in ICAO Item 15 conventions.'),
        groundSpeedKt: z
          .number()
          .positive()
          .optional()
          .describe(
            'Optional ground speed in knots used to compute estimated time enroute. Omit to skip ETE.',
          ),
      },
    },
    ({ routeString, groundSpeedKt }) => {
      const route = resolver.parse(routeString);
      const result = computeRouteDistance(route, groundSpeedKt);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      };
    },
  );
}
