/**
 * Route distance and estimated time enroute computation for parsed flight
 * plan routes. Sums great-circle leg distances over the ordered geographic
 * point sequence produced by the `route-geometry` module.
 */

import { greatCircle } from '@squawk/geo';

import type { ParsedRoute, RouteElement } from './resolver.js';
import { extractGeoPoints } from './route-geometry.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single leg between two consecutive geographic points in a parsed route.
 */
export interface RouteLeg {
  /** Identifier or raw token of the starting point. */
  from: string;
  /** Identifier or raw token of the ending point. */
  to: string;
  /** Latitude of the starting point in decimal degrees, positive north. */
  fromLat: number;
  /** Longitude of the starting point in decimal degrees, positive east. */
  fromLon: number;
  /** Latitude of the ending point in decimal degrees, positive north. */
  toLat: number;
  /** Longitude of the ending point in decimal degrees, positive east. */
  toLon: number;
  /** Great-circle distance of this leg in nautical miles. */
  distanceNm: number;
  /** Cumulative distance from the route start through the end of this leg in nautical miles. */
  cumulativeDistanceNm: number;
}

/**
 * Result of computing route distance and estimated time enroute from a
 * parsed flight plan route.
 */
export interface RouteDistanceResult {
  /** Ordered legs between consecutive geographic points. */
  legs: RouteLeg[];
  /** Total great-circle route distance in nautical miles. */
  totalDistanceNm: number;
  /** Estimated time enroute in hours, or `undefined` if no ground speed was provided. */
  estimatedTimeEnrouteHrs: number | undefined;
  /**
   * Route elements of type `unresolved` that could not contribute coordinates.
   * When these appear between geographic points the distance bridges the gap,
   * so the total may be approximate.
   */
  unresolvedElements: RouteElement[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Computes the total great-circle route distance and optional estimated time
 * enroute for a parsed flight plan route.
 *
 * Extracts the ordered sequence of geographic points from the route elements,
 * sums leg distances, and divides by the given ground speed for ETE.
 *
 * Elements without coordinates (DCT, speed/altitude groups) are silently
 * skipped. Unresolved tokens are collected in `unresolvedElements` to
 * indicate which parts of the route could not contribute to the distance
 * calculation.
 *
 * Airway segments use the FAA-published `distanceToNextNm` values when
 * available, falling back to great-circle computation otherwise.
 *
 * ```typescript
 * import { createFlightplanResolver, computeRouteDistance } from '@squawk/flightplan';
 *
 * const resolver = createFlightplanResolver({ airports, navaids, fixes, airways });
 * const route = resolver.parse('KJFK DCT MERIT J60 MARTN DCT KLAX');
 * const result = computeRouteDistance(route, 450);
 * console.log(result.totalDistanceNm, result.estimatedTimeEnrouteHrs);
 * ```
 *
 * @param route - A parsed route from {@link FlightplanResolver.parse}.
 * @param groundSpeedKt - Ground speed in knots for ETE calculation. Omit to
 *   skip ETE computation.
 * @returns Route distance breakdown with optional ETE.
 */
export function computeRouteDistance(
  route: ParsedRoute,
  groundSpeedKt?: number,
): RouteDistanceResult {
  const { points, unresolvedElements } = extractGeoPoints(route.elements);

  const legs: RouteLeg[] = [];
  let totalDistanceNm = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!;
    const to = points[i + 1]!;

    const legDistanceNm =
      from.precomputedDistanceToNextNm !== undefined
        ? from.precomputedDistanceToNextNm
        : greatCircle.distanceNm(from.lat, from.lon, to.lat, to.lon);

    totalDistanceNm += legDistanceNm;

    legs.push({
      from: from.label,
      to: to.label,
      fromLat: from.lat,
      fromLon: from.lon,
      toLat: to.lat,
      toLon: to.lon,
      distanceNm: legDistanceNm,
      cumulativeDistanceNm: totalDistanceNm,
    });
  }

  const estimatedTimeEnrouteHrs =
    groundSpeedKt !== undefined && groundSpeedKt > 0 ? totalDistanceNm / groundSpeedKt : undefined;

  return {
    legs,
    totalDistanceNm,
    estimatedTimeEnrouteHrs,
    unresolvedElements,
  };
}
