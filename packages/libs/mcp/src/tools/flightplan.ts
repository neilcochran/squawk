/**
 * @packageDocumentation
 * MCP tool module wrapping `@squawk/flightplan` route-string parsing,
 * great-circle distance, timing and geometry, and the airway altitude check.
 * The flightplan resolver composes the
 * shared airport, navaid, fix, airway, and procedure resolvers from the
 * package's `resolvers` module, so the first route parsed in a session loads
 * all five of those snapshots.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  checkRouteAltitudes,
  computeRouteDistance,
  computeRouteTiming,
  createFlightplanResolver,
  extractRoutePoints,
  routeToLineString,
  type FlightplanResolver,
} from '@squawk/flightplan';

import {
  getAirportResolver,
  getAirwayResolver,
  getFixResolver,
  getNavaidResolver,
  getProcedureResolver,
} from '../resolvers.js';

/**
 * Memoized composed resolver. Holding the promise rather than the finished
 * resolver means concurrent route parses share one load of the five
 * underlying snapshots instead of each building their own composition.
 */
let flightplanResolver: Promise<FlightplanResolver> | undefined;

/**
 * Returns the composed flightplan resolver, loading the five snapshots it
 * draws on (airports, navaids, fixes, airways, procedures) in parallel on the
 * first call. A rejected load clears the memo so a later call can retry.
 *
 * @returns The shared flightplan resolver.
 */
function getFlightplanResolver(): Promise<FlightplanResolver> {
  flightplanResolver ??= Promise.all([
    getAirportResolver(),
    getNavaidResolver(),
    getFixResolver(),
    getAirwayResolver(),
    getProcedureResolver(),
  ]).then(
    ([airports, navaids, fixes, airways, procedures]) =>
      createFlightplanResolver({ airports, navaids, fixes, airways, procedures }),
    (err: unknown) => {
      flightplanResolver = undefined;
      throw err;
    },
  );
  return flightplanResolver;
}

/** Navigation equipment kinds accepted by `check_route_altitudes`. */
const NAVIGATION_EQUIPMENT_VALUES = ['conventional', 'gnss', 'dmeDmeIru'] as const;

/**
 * Registers flight plan parsing, route distance, timing, geometry and altitude
 * check tools on the given MCP server. Each handler pulls the composed resolver from
 * {@link getFlightplanResolver}, which builds it from the bundled NASR and
 * CIFP snapshots on the first invocation.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerFlightplanTools(server: McpServer): void {
  server.registerTool(
    'parse_flightplan_route',
    {
      title: 'Parse a flight plan route string',
      description:
        'Parses a whitespace-separated flight plan route string (e.g. "KSEA DCT SEA J70 GEP DCT KJFK") into structured route elements. Each token is classified as an airport, SID, STAR, airway, direct (DCT), waypoint, lat/lon coordinate, speed/altitude group, or unresolved. A speed/altitude group attached to a point with a slash (an ICAO change of speed or level, as in "ENE/N0450F370") is split off: the point resolves on its own and the group element follows it with fromPoint naming the point, while a standalone group (the initial cruise speed and level) has no fromPoint. Airway tokens are expanded into waypoint sequences between the entry and exit fixes; each airway element carries a gaps array listing any published discontinuity the expansion crosses and an unusable array listing any segment the FAA marks unusable, and a non-empty one of either means the route files the airway where it is not defined or may not be flown, so it is not valid as filed. SID/STAR tokens are expanded into their common route; the dotted PROCCODE.TRANSITION form (e.g. "DEEZZ6.CANDR") merges the named transition, and without it the fix after a SID or before a STAR is used as the transition when the procedure publishes one by that name, as in "KJFK DEEZZ6 CANDR". A procedure that cannot be expanded (an unknown transition, or a transition-only procedure with no adjacent fix naming a transition) is marked unresolved. A SID is matched to the departure airport (the last airport before it) and a STAR to the arrival airport (the first airport after it), since many identifiers are published as a separate adaptation per airport; when no adaptation serves that airport the procedure is still expanded and its element carries airportMismatch with the airport, which means the route is not valid as filed. A token that is both an airport FAA identifier and a navaid resolves as the navaid when it is directly followed by an airway that lists it (the point the airway is joined at, as SAT in "SAT Q24 LSU") and as the airport otherwise; an ICAO code always names the airport.',
      inputSchema: {
        routeString: z
          .string()
          .min(1)
          .describe('Whitespace-separated route string in ICAO Item 15 conventions.'),
      },
    },
    async ({ routeString }) => {
      const resolver = await getFlightplanResolver();
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
        'Parses a flight plan route string and computes the total great-circle distance in nautical miles, the ordered list of legs with cumulative distance, and (when groundSpeedKt is supplied) the estimated time enroute in hours. Each leg carries the from/to point labels and their latitude/longitude in decimal degrees, so the result doubles as a drawable leg-by-leg geometry. Uses FAA-published per-segment distances on airway segments when available, in either direction of travel; otherwise falls back to great-circle computation. No altitude is checked: airway MEAs, crossing altitudes and procedure constraints are not applied. A leg whose crossesGap is true spans a published gap in its airway: it is a straight line counted in the total but not a flyable airway segment, so the route is not valid as filed. A leg whose unusable is true is an airway segment the FAA marks unusable, counted in the total but not to be flown. A leg whose procedureAirportMismatch is true runs along a SID or STAR filed at an airport it does not serve, or joins the route to that airport. Unresolved tokens are surfaced separately so the caller can decide whether to trust the total. To get the route as a single ordered point sequence or a GeoJSON LineString for map rendering, use get_route_geometry instead.',
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
    async ({ routeString, groundSpeedKt }) => {
      const resolver = await getFlightplanResolver();
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
    async ({ routeString }) => {
      const resolver = await getFlightplanResolver();
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
        'Parses a flight plan route string and computes per-leg, wind-corrected timing. For each leg it solves the wind triangle from the leg true course, the given true airspeed, and a uniform wind, yielding true heading, wind correction angle, and ground speed, then estimated time enroute (and fuel burn when fuelBurnPerHr is given). Supply a uniform wind via the optional wind object (direction the wind blows FROM in degrees true, and speed in knots) applied to every leg; omit it to time the route as calm, where ground speed equals true airspeed. When fuelBurnPerHr and fuelAvailable are both given, the result also reports endurance in hours and whether fuel is sufficient for the total time enroute. A leg whose ground speed is not positive (a pure headwind equal to true airspeed) is left untimed, which makes the route ETE and fuel totals null. A leg whose crossesGap is true spans a published gap in its airway and is timed as a straight line, a leg whose unusable is true is an airway segment the FAA marks unusable, and a leg whose procedureAirportMismatch is true runs along or into a SID or STAR filed at an airport it does not serve; any of these means the route is not valid as filed. Use compute_route_distance for plain distance or a single constant-ground-speed ETE without wind correction.',
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
    async ({ routeString, trueAirspeedKt, wind, fuelBurnPerHr, fuelAvailable }) => {
      const resolver = await getFlightplanResolver();
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

  server.registerTool(
    'check_route_altitudes',
    {
      title: 'Check a route against airway altitudes',
      description:
        'Parses a flight plan route string and checks the cruise altitude against the published airway altitudes. Each airway leg is checked against the MEA for the direction flown and the navigation equipment, and against the MAA; each airway fix is checked against its MCA for the direction flown and its MRA. The applicable MEA is the lowest usable with any of the equipment: conventional uses the conventional MEA; gnss uses the GNSS MEA where published and the conventional MEA otherwise, plus FL180 on US Jet and Q route segments that publish no GNSS MEA; dmeDmeIru uses only the DME/DME/IRU MEA. The altitude starts at altitudeFt, which replaces the opening speed/altitude group of the route, or else at that group, and changes at each group attached to a later point (as in "ENE/N0450F370") from that point onward; a flight level counts as hundreds of feet. Each leg and point has a status of pass, fail or notDeterminable with findings (code, kind, message) explaining it, plus the values used; legs line up with compute_route_distance legs and points with get_route_geometry points. The overall status is the worst across legs and points, or noAltitude when no altitude is known. Legs spanning a published gap or along an unusable segment fail as filed; direct, coordinate and procedure legs are notDeterminable since no published enroute altitude applies. Each leg also carries an advisory cruisingAltitude check (appropriate, inappropriate or notDeterminable) against the east/west rule of 14 CFR 91.179(b), with RVSM levels from FL290 to FL410, using the published airway course or else the great-circle course converted to magnetic; it names the nearest cruising altitudes when the altitude is wrong for the direction, skips SID and STAR legs, and never changes a status. Below the applicable MEA, a leg at or above the MOCA of the segment passes with a belowMeaAllowance when the equipment includes gnss, or includes conventional and the leg stays within 22 NM of the VOR it is navigated by (switching VORs at the published changeover point or midway); below the MOCA it fails. Procedure altitude constraints are not checked. Airway and point FAA remarks are passed through unparsed and may carry further altitude restrictions.',
      inputSchema: {
        routeString: z
          .string()
          .min(1)
          .describe('Whitespace-separated route string in ICAO Item 15 conventions.'),
        altitudeFt: z
          .number()
          .positive()
          .optional()
          .describe(
            'Cruise altitude in feet (FL350 is 35000). Replaces the opening speed/altitude group of the route; omit to use the groups in the route.',
          ),
        equipment: z
          .array(z.enum(NAVIGATION_EQUIPMENT_VALUES))
          .nonempty()
          .describe(
            'Navigation equipment aboard, at least one of conventional (VOR), gnss (IFR GPS) and dmeDmeIru (DME/DME/IRU RNAV).',
          ),
      },
    },
    async ({ routeString, altitudeFt, equipment }) => {
      // The input schema already rejects an empty list; this narrows the type.
      const [firstEquipment, ...otherEquipment] = equipment;
      if (firstEquipment === undefined) {
        return {
          content: [{ type: 'text', text: 'equipment must name at least one kind.' }],
          isError: true,
        };
      }
      const resolver = await getFlightplanResolver();
      const route = resolver.parse(routeString);
      const result = checkRouteAltitudes(route, {
        equipment: [firstEquipment, ...otherEquipment],
        ...(altitudeFt !== undefined ? { altitudeFt } : {}),
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      };
    },
  );
}
