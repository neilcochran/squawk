/**
 * Route distance and estimated time enroute computation for parsed flight
 * plan routes. Extracts the ordered geographic point sequence from a
 * {@link ParsedRoute} and sums great-circle leg distances.
 */

import { greatCircle } from '@squawk/geo';

import type { ParsedRoute, RouteElement } from './resolver.js';

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
// Internal types
// ---------------------------------------------------------------------------

/** A geographic point extracted from a route element. */
interface GeoPoint {
  /** Display label (identifier or raw token). */
  label: string;
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
  /**
   * Pre-computed distance to the next point along an airway segment in
   * nautical miles, if available from the source data.
   */
  precomputedDistanceToNextNm?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Epsilon for comparing coordinates to detect duplicate points. */
const COORD_EPSILON = 1e-9;

/**
 * Returns true if two points share the same coordinates (within epsilon).
 */
function samePosition(a: GeoPoint, b: GeoPoint): boolean {
  return Math.abs(a.lat - b.lat) < COORD_EPSILON && Math.abs(a.lon - b.lon) < COORD_EPSILON;
}

/**
 * Walks the route elements and extracts an ordered array of geographic
 * points. Duplicate consecutive points (e.g. an airway entry fix that
 * matches the preceding waypoint) are suppressed.
 *
 * Also collects all `unresolved` elements encountered during the walk.
 */
function extractGeoPoints(elements: RouteElement[]): {
  points: GeoPoint[];
  unresolvedElements: RouteElement[];
} {
  const points: GeoPoint[] = [];
  const unresolvedElements: RouteElement[] = [];

  function emit(point: GeoPoint): void {
    if (points.length > 0 && samePosition(points[points.length - 1]!, point)) {
      // When the duplicate carries a precomputed distance that the existing
      // point lacks, adopt it. This happens when an airway's entry fix
      // overlaps the preceding waypoint -- the airway waypoint has the
      // published segment distance that would otherwise be lost.
      const last = points[points.length - 1]!;
      if (
        point.precomputedDistanceToNextNm !== undefined &&
        last.precomputedDistanceToNextNm === undefined
      ) {
        last.precomputedDistanceToNextNm = point.precomputedDistanceToNextNm;
      }
      return;
    }
    points.push(point);
  }

  for (const el of elements) {
    switch (el.type) {
      case 'airport':
        emit({ label: el.raw, lat: el.airport.lat, lon: el.airport.lon });
        break;

      case 'waypoint':
        emit({ label: el.raw, lat: el.lat, lon: el.lon });
        break;

      case 'coordinate':
        emit({ label: el.raw, lat: el.lat, lon: el.lon });
        break;

      case 'airway':
        for (let i = 0; i < el.waypoints.length; i++) {
          const wp = el.waypoints[i]!;
          const isLast = i === el.waypoints.length - 1;
          const point: GeoPoint = {
            label: wp.identifier ?? wp.name,
            lat: wp.lat,
            lon: wp.lon,
          };
          // Only carry precomputed distance for non-last waypoints (the
          // last waypoint's distanceToNextNm points beyond this segment).
          if (!isLast && wp.distanceToNextNm !== undefined) {
            point.precomputedDistanceToNextNm = wp.distanceToNextNm;
          }
          emit(point);
        }
        break;

      case 'sid':
      case 'star':
        for (const wp of el.waypoints) {
          emit({ label: wp.fixIdentifier, lat: wp.lat, lon: wp.lon });
        }
        break;

      case 'unresolved':
        unresolvedElements.push(el);
        break;

      // 'direct' and 'speedAltitude' are expected non-geographic markers
      // and are silently skipped.
      case 'direct':
      case 'speedAltitude':
        break;
    }
  }

  return { points, unresolvedElements };
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
