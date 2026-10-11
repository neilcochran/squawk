import type { LineString } from 'geojson';

import {
  computeRouteDistance,
  extractRoutePoints,
  routeToLineString,
} from '@squawk/flightplan/browser';
import type {
  FlightplanResolver,
  ParsedRoute,
  RouteDistanceResult,
  RoutePoint,
} from '@squawk/flightplan/browser';

/**
 * Everything plan mode needs to render a resolved route string: the parsed
 * route, its drawable geometry, and the distance / ETE breakdown.
 */
export interface PlanRoute {
  /** The parsed route - ordered, classified, coordinate-resolved elements. */
  parsed: ParsedRoute;
  /** Ordered drawable points (airports, waypoints, expanded airway / procedure legs). */
  points: RoutePoint[];
  /** A single GeoJSON LineString through the points, or `undefined` for fewer than two. */
  line: LineString | undefined;
  /** Per-leg and total distance plus the optional ETE. */
  distance: RouteDistanceResult;
}

/**
 * Resolves a flight-plan route string into the parsed route, its drawable
 * geometry, and the distance / ETE breakdown. Pure - resolver and string in,
 * a {@link PlanRoute} out, with no React, map, or network - so it is
 * unit-testable without a render harness.
 *
 * Returns `undefined` for a blank or whitespace-only route so callers can
 * render the empty state without forcing a parse.
 *
 * @param resolver - Composed flightplan resolver from {@link usePlanResolver}.
 * @param routeString - Raw route string, e.g. `KLAX DCT LAX J60 SAX DCT KJFK`.
 * @param groundSpeedKt - Optional ground speed in knots for the ETE estimate.
 * @returns The resolved route, or `undefined` when the route string is empty.
 */
export function buildPlanRoute(
  resolver: FlightplanResolver,
  routeString: string,
  groundSpeedKt?: number,
): PlanRoute | undefined {
  if (routeString.trim().length === 0) {
    return undefined;
  }
  const parsed = resolver.parse(routeString);
  return {
    parsed,
    points: extractRoutePoints(parsed),
    line: routeToLineString(parsed),
    distance: computeRouteDistance(parsed, groundSpeedKt),
  };
}
