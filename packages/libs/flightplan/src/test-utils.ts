import type { Airport, AirwayWaypoint, ProcedureLeg } from '@squawk/types';

import type {
  AirportRouteElement,
  AirwayRouteElement,
  CoordinateRouteElement,
  DirectRouteElement,
  ParsedRoute,
  RouteElement,
  SidRouteElement,
  SpeedAltitudeRouteElement,
  StarRouteElement,
  UnresolvedRouteElement,
  WaypointRouteElement,
} from './resolver.js';

/**
 * Returns true if two numbers are within the given delta of each other.
 * Used across spec files for floating-point comparisons.
 *
 * @param a - First value to compare.
 * @param b - Second value to compare.
 * @param delta - Maximum allowed absolute difference (default: 0.01).
 * @returns True if |a - b| <= delta.
 */
export function close(a: number, b: number, delta = 0.01): boolean {
  return Math.abs(a - b) <= delta;
}

/**
 * Builds a synthetic airport route element for tests.
 *
 * @param raw - Raw token / label.
 * @param lat - Latitude in decimal degrees.
 * @param lon - Longitude in decimal degrees.
 * @returns An airport route element.
 */
export function makeAirport(raw: string, lat: number, lon: number): AirportRouteElement {
  return {
    type: 'airport',
    raw,
    airport: { lat, lon, faaId: raw, name: raw } as Airport,
  };
}

/**
 * Builds a synthetic waypoint route element for tests.
 *
 * @param raw - Raw token / label.
 * @param lat - Latitude in decimal degrees.
 * @param lon - Longitude in decimal degrees.
 * @returns A waypoint route element.
 */
export function makeWaypoint(raw: string, lat: number, lon: number): WaypointRouteElement {
  return { type: 'waypoint', raw, lat, lon };
}

/**
 * Builds a synthetic coordinate route element for tests.
 *
 * @param raw - Raw token / label.
 * @param lat - Latitude in decimal degrees.
 * @param lon - Longitude in decimal degrees.
 * @returns A coordinate route element.
 */
export function makeCoordinate(raw: string, lat: number, lon: number): CoordinateRouteElement {
  return { type: 'coordinate', raw, lat, lon };
}

/**
 * Builds a synthetic DCT (direct) route element for tests.
 *
 * @returns A direct route element.
 */
export function makeDirect(): DirectRouteElement {
  return { type: 'direct', raw: 'DCT' };
}

/**
 * Builds a synthetic speed/altitude route element for tests.
 *
 * @returns A speed/altitude route element.
 */
export function makeSpeedAltitude(): SpeedAltitudeRouteElement {
  return { type: 'speedAltitude', raw: 'N0450F350', speedKt: 450, flightLevel: 350 };
}

/**
 * Builds a synthetic unresolved route element for tests.
 *
 * @param raw - Raw token / label.
 * @returns An unresolved route element.
 */
export function makeUnresolved(raw: string): UnresolvedRouteElement {
  return { type: 'unresolved', raw };
}

/**
 * Builds a synthetic airway route element for tests.
 *
 * @param raw - Airway designation / raw token.
 * @param waypoints - Ordered waypoints, each with optional name/identifier,
 *   coordinates, and an optional precomputed distance to the next waypoint.
 * @returns An airway route element.
 */
export function makeAirway(
  raw: string,
  waypoints: {
    name?: string;
    identifier?: string;
    lat: number;
    lon: number;
    distanceToNextNm?: number;
  }[],
): AirwayRouteElement {
  return {
    type: 'airway',
    raw,
    airway: { designation: raw, type: 'JET', region: 'US', waypoints: [] } as never,
    entryFix: waypoints[0]?.identifier ?? waypoints[0]?.name ?? '',
    exitFix:
      waypoints[waypoints.length - 1]?.identifier ?? waypoints[waypoints.length - 1]?.name ?? '',
    waypoints: waypoints.map((wp) => {
      const base: AirwayWaypoint = {
        name: wp.name ?? wp.identifier ?? '',
        waypointType: 'FIX',
        lat: wp.lat,
        lon: wp.lon,
      };
      if (wp.identifier !== undefined) {
        base.identifier = wp.identifier;
      }
      if (wp.distanceToNextNm !== undefined) {
        base.distanceToNextNm = wp.distanceToNextNm;
      }
      return base;
    }),
  };
}

/**
 * Builds a synthetic procedure leg for SID/STAR test fixtures. Coordinate-less
 * legs (e.g. heading-to-altitude legs) are represented by omitting the fix
 * identifier and coordinates, mirroring how the resolver surfaces non-fix legs.
 *
 * @param fix - Optional fix identifier and coordinates for the leg.
 * @returns A procedure leg.
 */
function makeProcedureLeg(fix: { fixIdentifier?: string; lat?: number; lon?: number }): ProcedureLeg {
  const leg: ProcedureLeg = { pathTerminator: 'TF' };
  if (fix.fixIdentifier !== undefined) {
    leg.fixIdentifier = fix.fixIdentifier;
    leg.category = 'FIX';
  }
  if (fix.lat !== undefined) {
    leg.lat = fix.lat;
  }
  if (fix.lon !== undefined) {
    leg.lon = fix.lon;
  }
  return leg;
}

/**
 * Builds a synthetic SID route element for tests.
 *
 * @param raw - Procedure identifier / raw token.
 * @param fixes - Ordered fixes, each with an optional identifier and
 *   coordinates. Omit the coordinates to model a coordinate-less leg.
 * @returns A SID route element.
 */
export function makeSid(
  raw: string,
  fixes: { fixIdentifier?: string; lat?: number; lon?: number }[],
): SidRouteElement {
  return {
    type: 'sid',
    raw,
    procedure: {
      name: raw,
      identifier: raw,
      type: 'SID',
      airports: [],
      commonRoutes: [],
      transitions: [],
    },
    legs: fixes.map(makeProcedureLeg),
  };
}

/**
 * Builds a synthetic STAR route element for tests.
 *
 * @param raw - Procedure identifier / raw token.
 * @param fixes - Ordered fixes, each with an optional identifier and
 *   coordinates. Omit the coordinates to model a coordinate-less leg.
 * @returns A STAR route element.
 */
export function makeStar(
  raw: string,
  fixes: { fixIdentifier?: string; lat?: number; lon?: number }[],
): StarRouteElement {
  return {
    type: 'star',
    raw,
    procedure: {
      name: raw,
      identifier: raw,
      type: 'STAR',
      airports: [],
      commonRoutes: [],
      transitions: [],
    },
    legs: fixes.map(makeProcedureLeg),
  };
}

/**
 * Wraps an ordered list of route elements in a parsed route for tests.
 *
 * @param elements - Ordered route elements.
 * @returns A parsed route with a fixed raw string.
 */
export function route(elements: RouteElement[]): ParsedRoute {
  return { raw: 'test', elements };
}
