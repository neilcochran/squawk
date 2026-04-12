import type {
  Airport,
  Airway,
  AirwayWaypoint,
  Fix,
  Navaid,
  Procedure,
  ProcedureWaypoint,
} from '@squawk/types';

// ---------------------------------------------------------------------------
// Minimal resolver interfaces (structurally compatible with the real resolvers)
// ---------------------------------------------------------------------------

/**
 * Minimal airport lookup interface consumed by the flightplan resolver.
 * Structurally compatible with {@link @squawk/airports!AirportResolver}.
 */
export interface FlightplanAirportLookup {
  /** Looks up an airport by FAA location identifier (e.g. "JFK"). */
  byFaaId(faaId: string): Airport | undefined;
  /** Looks up an airport by ICAO code (e.g. "KJFK"). */
  byIcao(icao: string): Airport | undefined;
}

/**
 * Minimal navaid lookup interface consumed by the flightplan resolver.
 * Structurally compatible with {@link @squawk/navaids!NavaidResolver}.
 */
export interface FlightplanNavaidLookup {
  /** Looks up navaids by identifier. Returns an empty array if none found. */
  byIdent(ident: string): Navaid[];
}

/**
 * Minimal fix lookup interface consumed by the flightplan resolver.
 * Structurally compatible with {@link @squawk/fixes!FixResolver}.
 */
export interface FlightplanFixLookup {
  /** Looks up fixes by identifier. Returns an empty array if none found. */
  byIdent(ident: string): Fix[];
}

/**
 * Minimal airway lookup interface consumed by the flightplan resolver.
 * Structurally compatible with {@link @squawk/airways!AirwayResolver}.
 */
export interface FlightplanAirwayLookup {
  /** Looks up airways by designation (e.g. "V16", "J60"). Returns an empty array if none found. */
  byDesignation(designation: string): Airway[];
  /** Expands an airway between entry and exit fixes, returning ordered waypoints. */
  expand(
    designation: string,
    entryFix: string,
    exitFix: string,
  ): { airway: Airway; waypoints: AirwayWaypoint[] } | undefined;
}

/**
 * Minimal procedure lookup interface consumed by the flightplan resolver.
 * Structurally compatible with {@link @squawk/procedures!ProcedureResolver}.
 */
export interface FlightplanProcedureLookup {
  /** Looks up a procedure by FAA computer code (e.g. "AALLE4"). */
  byName(computerCode: string): Procedure | undefined;
  /** Expands a procedure into an ordered waypoint sequence. */
  expand(
    computerCode: string,
    transitionName?: string,
  ): { procedure: Procedure; waypoints: ProcedureWaypoint[] } | undefined;
}

// ---------------------------------------------------------------------------
// Route element types (discriminated union)
// ---------------------------------------------------------------------------

/**
 * A departure or arrival airport in the route.
 */
export interface AirportRouteElement {
  /** Discriminant for airport elements. */
  type: 'airport';
  /** Raw token from the route string. */
  raw: string;
  /** Resolved airport record. */
  airport: Airport;
}

/**
 * A Standard Instrument Departure (SID) in the route.
 */
export interface SidRouteElement {
  /** Discriminant for SID elements. */
  type: 'sid';
  /** Raw token from the route string. */
  raw: string;
  /** Resolved procedure record. */
  procedure: Procedure;
  /** Ordered waypoint sequence for the procedure. */
  waypoints: ProcedureWaypoint[];
}

/**
 * A Standard Terminal Arrival Route (STAR) in the route.
 */
export interface StarRouteElement {
  /** Discriminant for STAR elements. */
  type: 'star';
  /** Raw token from the route string. */
  raw: string;
  /** Resolved procedure record. */
  procedure: Procedure;
  /** Ordered waypoint sequence for the procedure. */
  waypoints: ProcedureWaypoint[];
}

/**
 * A segment along a published airway between an entry fix and exit fix.
 */
export interface AirwayRouteElement {
  /** Discriminant for airway elements. */
  type: 'airway';
  /** Raw token from the route string (airway designation). */
  raw: string;
  /** Resolved airway record. */
  airway: Airway;
  /** Identifier of the entry fix. */
  entryFix: string;
  /** Identifier of the exit fix. */
  exitFix: string;
  /** Ordered waypoints from entry to exit fix (inclusive). */
  waypoints: AirwayWaypoint[];
}

/**
 * A DCT (direct) indicator between two waypoints.
 */
export interface DirectRouteElement {
  /** Discriminant for direct elements. */
  type: 'direct';
  /** Raw token from the route string ("DCT"). */
  raw: string;
}

/**
 * A resolved waypoint (fix or navaid) in the route.
 */
export interface WaypointRouteElement {
  /** Discriminant for waypoint elements. */
  type: 'waypoint';
  /** Raw token from the route string. */
  raw: string;
  /** Resolved fix record, if the waypoint matched a fix. */
  fix?: Fix;
  /** Resolved navaid record, if the waypoint matched a navaid. */
  navaid?: Navaid;
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
}

/**
 * A latitude/longitude coordinate specified directly in the route string.
 */
export interface CoordinateRouteElement {
  /** Discriminant for coordinate elements. */
  type: 'coordinate';
  /** Raw token from the route string. */
  raw: string;
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
}

/**
 * A speed and/or altitude group from the route string (e.g. "N0450F350").
 */
export interface SpeedAltitudeRouteElement {
  /** Discriminant for speed/altitude elements. */
  type: 'speedAltitude';
  /** Raw token from the route string. */
  raw: string;
  /** Speed in knots, if specified with N prefix. */
  speedKt?: number;
  /** Speed in km/h, if specified with K prefix. */
  speedKmPerHr?: number;
  /** Mach number (e.g. 0.82), if specified with M prefix. */
  mach?: number;
  /** Flight level (e.g. 350 for FL350), if specified with F prefix. */
  flightLevel?: number;
  /** Altitude in feet, if specified with A prefix. */
  altitudeFt?: number;
}

/**
 * A route token that could not be resolved to any known element.
 */
export interface UnresolvedRouteElement {
  /** Discriminant for unresolved elements. */
  type: 'unresolved';
  /** Raw token from the route string. */
  raw: string;
}

/**
 * A single element in a parsed flight plan route. Uses a discriminated union
 * on the `type` field.
 */
export type RouteElement =
  | AirportRouteElement
  | SidRouteElement
  | StarRouteElement
  | AirwayRouteElement
  | DirectRouteElement
  | WaypointRouteElement
  | CoordinateRouteElement
  | SpeedAltitudeRouteElement
  | UnresolvedRouteElement;

/**
 * The result of parsing a flight plan route string.
 */
export interface ParsedRoute {
  /** The original route string that was parsed. */
  raw: string;
  /** Ordered sequence of resolved route elements. */
  elements: RouteElement[];
}

// ---------------------------------------------------------------------------
// Resolver options and interface
// ---------------------------------------------------------------------------

/**
 * Options for creating a flightplan resolver. All lookup providers are optional;
 * tokens that require a missing provider will be marked as unresolved.
 */
export interface FlightplanResolverOptions {
  /** Airport lookup provider. */
  airports?: FlightplanAirportLookup;
  /** Navaid lookup provider. */
  navaids?: FlightplanNavaidLookup;
  /** Fix lookup provider. */
  fixes?: FlightplanFixLookup;
  /** Airway lookup provider. */
  airways?: FlightplanAirwayLookup;
  /** Procedure lookup provider. */
  procedures?: FlightplanProcedureLookup;
}

/**
 * A stateless resolver that parses flight plan route strings into structured,
 * resolved route elements.
 */
export interface FlightplanResolver {
  /**
   * Parses a flight plan route string into an ordered sequence of resolved
   * route elements. Each token in the route string is classified and resolved
   * against the configured lookup providers.
   *
   * Airway tokens are expanded into waypoint sequences between entry and exit
   * fixes. Procedure tokens (SIDs/STARs) are expanded into waypoint sequences.
   * Unresolvable tokens are preserved as `unresolved` elements.
   */
  parse(routeString: string): ParsedRoute;
}

// ---------------------------------------------------------------------------
// Coordinate parsing
// ---------------------------------------------------------------------------

/**
 * Pattern for DDMM[N/S]DDDMM[E/W] coordinates (e.g. "4000N07000W").
 */
const COORD_DDMM_RE = /^(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])$/;

/**
 * Pattern for DD[N/S]DDD[E/W] coordinates (e.g. "40N070W").
 */
const COORD_DD_RE = /^(\d{2})([NS])(\d{3})([EW])$/;

/**
 * Attempts to parse a token as a latitude/longitude coordinate.
 * Supports DDMMN/DDDMMEW and DDN/DDDEW formats.
 * Returns the parsed lat/lon or undefined if the token is not a coordinate.
 */
function parseCoordinate(token: string): { lat: number; lon: number } | undefined {
  let match = COORD_DDMM_RE.exec(token);
  if (match) {
    const latDeg = parseInt(match[1]!, 10);
    const latMin = parseInt(match[2]!, 10);
    const latSign = match[3] === 'S' ? -1 : 1;
    const lonDeg = parseInt(match[4]!, 10);
    const lonMin = parseInt(match[5]!, 10);
    const lonSign = match[6] === 'W' ? -1 : 1;
    return {
      lat: latSign * (latDeg + latMin / 60),
      lon: lonSign * (lonDeg + lonMin / 60),
    };
  }

  match = COORD_DD_RE.exec(token);
  if (match) {
    const latDeg = parseInt(match[1]!, 10);
    const latSign = match[2] === 'S' ? -1 : 1;
    const lonDeg = parseInt(match[3]!, 10);
    const lonSign = match[4] === 'W' ? -1 : 1;
    return {
      lat: latSign * latDeg,
      lon: lonSign * lonDeg,
    };
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Speed/altitude parsing
// ---------------------------------------------------------------------------

/**
 * Pattern for speed/altitude groups.
 * Speed: N (knots, 4 digits), K (km/h, 4 digits), M (mach, 3 digits).
 * Altitude: F (flight level, 3 digits), A (altitude in hundreds of feet, 3 digits).
 */
const SPEED_ALT_RE = /^([NKM])(\d{3,4})([FA])(\d{3,4})$/;

/**
 * Attempts to parse a token as a speed/altitude group.
 * Returns the parsed values or undefined if the token is not a speed/altitude group.
 */
function parseSpeedAltitude(token: string): SpeedAltitudeRouteElement | undefined {
  const match = SPEED_ALT_RE.exec(token);
  if (!match) {
    return undefined;
  }

  const speedPrefix = match[1]!;
  const speedValue = parseInt(match[2]!, 10);
  const altPrefix = match[3]!;
  const altValue = parseInt(match[4]!, 10);

  const result: SpeedAltitudeRouteElement = {
    type: 'speedAltitude',
    raw: token,
  };

  if (speedPrefix === 'N') {
    result.speedKt = speedValue;
  } else if (speedPrefix === 'K') {
    result.speedKmPerHr = speedValue;
  } else {
    result.mach = speedValue / 100;
  }

  if (altPrefix === 'F') {
    result.flightLevel = altValue;
  } else {
    result.altitudeFt = altValue * 100;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Token resolution helpers
// ---------------------------------------------------------------------------

/**
 * Attempts to resolve a token as an airport (ICAO or FAA ID).
 */
function tryAirport(
  token: string,
  airports: FlightplanAirportLookup | undefined,
): AirportRouteElement | undefined {
  if (!airports) {
    return undefined;
  }

  const airport = airports.byIcao(token) ?? airports.byFaaId(token);
  if (airport) {
    return { type: 'airport', raw: token, airport };
  }
  return undefined;
}

/**
 * Attempts to resolve a token as a SID or STAR procedure.
 */
function tryProcedure(
  token: string,
  procedures: FlightplanProcedureLookup | undefined,
): SidRouteElement | StarRouteElement | undefined {
  if (!procedures) {
    return undefined;
  }

  const proc = procedures.byName(token);
  if (!proc) {
    return undefined;
  }

  const expansion = procedures.expand(token);
  const waypoints = expansion ? expansion.waypoints : [];

  if (proc.type === 'SID') {
    return { type: 'sid', raw: token, procedure: proc, waypoints };
  }
  return { type: 'star', raw: token, procedure: proc, waypoints };
}

/**
 * Attempts to resolve a token as a fix waypoint.
 */
function tryFix(
  token: string,
  fixes: FlightplanFixLookup | undefined,
): WaypointRouteElement | undefined {
  if (!fixes) {
    return undefined;
  }

  const results = fixes.byIdent(token);
  if (results.length > 0) {
    const fix = results[0]!;
    return { type: 'waypoint', raw: token, fix, lat: fix.lat, lon: fix.lon };
  }
  return undefined;
}

/**
 * Attempts to resolve a token as a navaid waypoint.
 */
function tryNavaid(
  token: string,
  navaids: FlightplanNavaidLookup | undefined,
): WaypointRouteElement | undefined {
  if (!navaids) {
    return undefined;
  }

  const results = navaids.byIdent(token);
  if (results.length > 0) {
    const navaid = results[0]!;
    return { type: 'waypoint', raw: token, navaid, lat: navaid.lat, lon: navaid.lon };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Main parse implementation
// ---------------------------------------------------------------------------

/**
 * Creates a stateless flightplan resolver that parses route strings into
 * structured, resolved route elements. The resolver composes optional lookup
 * providers for airports, navaids, fixes, airways, and procedures to resolve
 * each token in the route string.
 *
 * All lookup providers are optional. Tokens that require a missing provider
 * are marked as `unresolved`. This allows consumers to use only the resolvers
 * they have available.
 *
 * ```typescript
 * import { createFlightplanResolver } from '@squawk/flightplan';
 * import { createAirportResolver } from '@squawk/airports';
 * import { createNavaidResolver } from '@squawk/navaids';
 * import { createFixResolver } from '@squawk/fixes';
 * import { createAirwayResolver } from '@squawk/airways';
 * import { createProcedureResolver } from '@squawk/procedures';
 * import { usBundledAirports } from '@squawk/airport-data';
 * import { usBundledNavaids } from '@squawk/navaid-data';
 * import { usBundledFixes } from '@squawk/fix-data';
 * import { usBundledAirways } from '@squawk/airway-data';
 * import { usBundledProcedures } from '@squawk/procedure-data';
 *
 * const resolver = createFlightplanResolver({
 *   airports: createAirportResolver({ data: usBundledAirports.records }),
 *   navaids: createNavaidResolver({ data: usBundledNavaids.records }),
 *   fixes: createFixResolver({ data: usBundledFixes.records }),
 *   airways: createAirwayResolver({ data: usBundledAirways.records }),
 *   procedures: createProcedureResolver({ data: usBundledProcedures.records }),
 * });
 *
 * const route = resolver.parse('KJFK DCT MERIT J60 MARTN DCT KLAX');
 * for (const element of route.elements) {
 *   console.log(element.type, element.raw);
 * }
 * ```
 */
export function createFlightplanResolver(options: FlightplanResolverOptions): FlightplanResolver {
  const { airports, navaids, fixes, airways, procedures } = options;

  return {
    parse(routeString: string): ParsedRoute {
      const raw = routeString.trim();
      if (raw.length === 0) {
        return { raw, elements: [] };
      }

      const tokens = raw.split(/\s+/);
      const elements: RouteElement[] = [];
      let lastWaypointIdent: string | undefined;

      let i = 0;
      while (i < tokens.length) {
        const token = tokens[i]!.toUpperCase();

        // DCT (direct)
        if (token === 'DCT') {
          elements.push({ type: 'direct', raw: token });
          i++;
          continue;
        }

        // Lat/lon coordinate
        const coord = parseCoordinate(token);
        if (coord) {
          elements.push({ type: 'coordinate', raw: token, lat: coord.lat, lon: coord.lon });
          lastWaypointIdent = undefined;
          i++;
          continue;
        }

        // Speed/altitude group
        const speedAlt = parseSpeedAltitude(token);
        if (speedAlt) {
          elements.push(speedAlt);
          i++;
          continue;
        }

        // Try airway expansion (requires previous waypoint and next token as exit fix)
        if (lastWaypointIdent && airways && i + 1 < tokens.length) {
          const candidates = airways.byDesignation(token);
          if (candidates.length > 0) {
            const exitFix = tokens[i + 1]!.toUpperCase();
            const expansion = airways.expand(token, lastWaypointIdent, exitFix);
            if (expansion) {
              elements.push({
                type: 'airway',
                raw: token,
                airway: expansion.airway,
                entryFix: lastWaypointIdent,
                exitFix,
                waypoints: expansion.waypoints,
              });
              // The exit fix is consumed as part of the airway; update last waypoint
              lastWaypointIdent = exitFix;
              i += 2;
              continue;
            }
            // Airway recognized but expansion failed (entry/exit fixes not on it).
            // Mark as unresolved rather than falling through to other resolution
            // strategies, since airway designations should not resolve as fixes,
            // navaids, or airports. The exit fix token is NOT consumed and will be
            // parsed independently on the next iteration.
            elements.push({ type: 'unresolved', raw: token });
            lastWaypointIdent = undefined;
            i++;
            continue;
          }
        }

        // Token is a recognized airway but has no previous waypoint context or
        // no next token to use as an exit fix. Mark as unresolved.
        if (airways && airways.byDesignation(token).length > 0) {
          elements.push({ type: 'unresolved', raw: token });
          lastWaypointIdent = undefined;
          i++;
          continue;
        }

        // Try airport
        const airportElement = tryAirport(token, airports);
        if (airportElement) {
          elements.push(airportElement);
          // Preserve the token as lastWaypointIdent so a following airway can
          // use it as the entry fix (e.g. "BOS V16 CCC" where BOS is both an
          // airport and a navaid on V16).
          lastWaypointIdent = token;
          i++;
          continue;
        }

        // Try procedure (SID/STAR)
        const procElement = tryProcedure(token, procedures);
        if (procElement) {
          elements.push(procElement);
          // Update last waypoint to the last fix in the procedure
          if (procElement.waypoints.length > 0) {
            lastWaypointIdent =
              procElement.waypoints[procElement.waypoints.length - 1]!.fixIdentifier;
          }
          i++;
          continue;
        }

        // Try fix
        const fixElement = tryFix(token, fixes);
        if (fixElement) {
          elements.push(fixElement);
          lastWaypointIdent = token;
          i++;
          continue;
        }

        // Try navaid
        const navaidElement = tryNavaid(token, navaids);
        if (navaidElement) {
          elements.push(navaidElement);
          lastWaypointIdent = token;
          i++;
          continue;
        }

        // Unresolved
        elements.push({ type: 'unresolved', raw: token });
        lastWaypointIdent = undefined;
        i++;
      }

      return { raw, elements };
    },
  };
}
