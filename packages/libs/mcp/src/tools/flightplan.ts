/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/flightplan` route-string parsing and
 * great-circle distance computation. The flightplan resolver composes the
 * shared airport, navaid, fix, airway, and procedure resolvers from the
 * package's `resolvers` module.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  computeRouteDistance,
  computeRouteTiming,
  createFlightplanResolver,
  extractRoutePoints,
  routeToLineString,
} from '@squawk/flightplan';

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
        'Parses a whitespace-separated flight plan route string (e.g. "KJFK DCT MERIT J60 MARTN DCT KLAX") into structured route elements. Each token is classified as an airport, SID, STAR, airway, direct (DCT), waypoint, lat/lon coordinate, speed/altitude group, or unresolved. Airway tokens are expanded into waypoint sequences between the entry and exit fixes. SID/STAR tokens are expanded into their first common route, and the dotted PROCCODE.TRANSITION form (e.g. "NUBLE4.JJIMY") additionally merges the named transition\'s waypoints into the expansion.',
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
        'Parses a flight plan route string and computes the total great-circle distance in nautical miles, the ordered list of legs with cumulative distance, and (when groundSpeedKt is supplied) the estimated time enroute in hours. Each leg carries the from/to point labels and their latitude/longitude in decimal degrees, so the result doubles as a drawable leg-by-leg geometry. Uses FAA-published per-segment distances on airway segments when available; otherwise falls back to great-circle computation. Unresolved tokens are surfaced separately so the caller can decide whether to trust the total. To get the route as a single ordered point sequence or a GeoJSON LineString for map rendering, use get_route_geometry instead.',
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

  server.registerTool(
    'get_route_geometry',
    {
      title: 'Get drawable route geometry',
      description:
        'Parses a flight plan route string and returns its drawable geometry: the ordered sequence of geographic points (each with a label and latitude/longitude in decimal degrees) and a GeoJSON LineString ready to render as a polyline on a map. Airway and SID/STAR segments are expanded into their constituent fixes, and consecutive duplicate points (e.g. an airway entry fix that matches the preceding waypoint) are suppressed. LineString coordinates follow the GeoJSON [lon, lat] ordering. The lineString field is omitted when the route yields fewer than two drawable points, since a LineString requires at least two positions. Use compute_route_distance instead when you need leg distances or estimated time enroute.',
      inputSchema: {
        routeString: z
          .string()
          .min(1)
          .describe('Whitespace-separated route string in ICAO Item 15 conventions.'),
      },
    },
    ({ routeString }) => {
      const route = resolver.parse(routeString);
      const points = extractRoutePoints(route);
      const lineString = routeToLineString(route);
      const result = { points, lineString };
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    'get_route_timing',
    {
      title: 'Compute wind-corrected route timing',
      description:
        'Parses a flight plan route string and computes per-leg, wind-corrected timing. For each leg it solves the wind triangle from the leg true course, the given true airspeed, and a uniform wind, yielding true heading, wind correction angle, and ground speed, then estimated time enroute (and fuel burn when fuelBurnPerHr is given). Supply a uniform wind via the optional wind object (direction the wind blows FROM in degrees true, and speed in knots) applied to every leg; omit it to time the route as calm, where ground speed equals true airspeed. When fuelBurnPerHr and fuelAvailable are both given, the result also reports endurance in hours and whether fuel is sufficient for the total time enroute. A leg whose ground speed is not positive (a pure headwind equal to true airspeed) is left untimed, which makes the route ETE and fuel totals null. Use compute_route_distance for plain distance or a single constant-ground-speed ETE without wind correction.',
      inputSchema: {
        routeString: z
          .string()
          .min(1)
          .describe('Whitespace-separated route string in ICAO Item 15 conventions.'),
        trueAirspeedKt: z
          .number()
          .positive()
          .describe('True airspeed in knots flown on every leg.'),
        wind: z
          .object({
            directionDeg: z
              .number()
              .min(0)
              .max(360)
              .describe('Direction the wind blows FROM in degrees true (0-360).'),
            speedKt: z.number().nonnegative().describe('Wind speed in knots.'),
          })
          .optional()
          .describe(
            'Uniform wind applied to every leg. Omit to time the route as calm (ground speed equals true airspeed).',
          ),
        fuelBurnPerHr: z
          .number()
          .positive()
          .optional()
          .describe(
            'Optional fuel burn rate per hour in any consistent unit. When given, per-leg and total fuel are computed.',
          ),
        fuelAvailable: z
          .number()
          .positive()
          .optional()
          .describe(
            'Optional fuel on board in the same unit as fuelBurnPerHr. With the burn rate, enables endurance and fuel-sufficiency reporting.',
          ),
      },
    },
    ({ routeString, trueAirspeedKt, wind, fuelBurnPerHr, fuelAvailable }) => {
      const route = resolver.parse(routeString);
      const result = computeRouteTiming(route, {
        trueAirspeedKt,
        ...(wind !== undefined ? { windProvider: () => wind } : {}),
        ...(fuelBurnPerHr !== undefined ? { fuelBurnPerHr } : {}),
        ...(fuelAvailable !== undefined ? { fuelAvailable } : {}),
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      };
    },
  );
}
