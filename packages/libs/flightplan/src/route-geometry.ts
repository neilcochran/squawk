/**
 * Drawable geometry extraction for parsed flight plan routes. Walks the
 * {@link ParsedRoute} elements into an ordered point sequence - expanding
 * airway waypoints, flattening SID/STAR legs, and suppressing consecutive
 * duplicate points - and exposes that sequence both as plain
 * {@link RoutePoint} values and as a GeoJSON `LineString` for map rendering.
 *
 * The same walk feeds `computeRouteDistance` in the `route-distance` module,
 * so distance and geometry stay in agreement.
 */

import type { LineString } from 'geojson';

import type { ParsedRoute, RouteElement } from './resolver.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single drawable geographic point along a parsed route, in route order.
 */
export interface RoutePoint {
  /** Display label (identifier or raw token) for the point. */
  label: string;
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * A geographic point extracted from a route element. Internal to the package;
 * carries the precomputed airway segment distance that `computeRouteDistance`
 * needs but that is not part of the public {@link RoutePoint} shape.
 *
 * @internal
 */
export interface GeoPoint {
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
 *
 * Internal to the package: `extractRoutePoints` and `routeToLineString`
 * project this into public shapes, and `computeRouteDistance` consumes the
 * precomputed segment distances directly.
 *
 * @internal
 */
export function extractGeoPoints(elements: RouteElement[]): {
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
        for (const leg of el.legs) {
          if (leg.fixIdentifier === undefined || leg.lat === undefined || leg.lon === undefined) {
            continue;
          }
          emit({ label: leg.fixIdentifier, lat: leg.lat, lon: leg.lon });
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
 * Extracts the ordered sequence of drawable geographic points from a parsed
 * flight plan route.
 *
 * Expands airway and SID/STAR segments into their constituent fixes and
 * suppresses consecutive duplicate points (e.g. an airway entry fix that
 * matches the preceding waypoint). Elements without coordinates (DCT,
 * speed/altitude groups, unresolved tokens) contribute no points.
 *
 * This is the same walk that backs `computeRouteDistance`, so the point
 * sequence here lines up with that result's legs.
 *
 * ```typescript
 * import { createFlightplanResolver, extractRoutePoints } from '@squawk/flightplan';
 *
 * const resolver = createFlightplanResolver({ airports, navaids, fixes, airways });
 * const route = resolver.parse('KJFK DCT MERIT J60 MARTN DCT KLAX');
 * const points = extractRoutePoints(route);
 * ```
 *
 * @param route - A parsed route from {@link FlightplanResolver.parse}.
 * @returns Ordered drawable points along the route.
 */
export function extractRoutePoints(route: ParsedRoute): RoutePoint[] {
  const { points } = extractGeoPoints(route.elements);
  return points.map((p) => ({ label: p.label, lat: p.lat, lon: p.lon }));
}

/**
 * Builds a GeoJSON `LineString` from a parsed flight plan route, ready to
 * render as a polyline on a map (e.g. MapLibre, Leaflet).
 *
 * Coordinates follow the GeoJSON `[lon, lat]` ordering. Returns `undefined`
 * when the route yields fewer than two drawable points, since a `LineString`
 * requires at least two positions to be valid.
 *
 * ```typescript
 * import { createFlightplanResolver, routeToLineString } from '@squawk/flightplan';
 *
 * const resolver = createFlightplanResolver({ airports, navaids, fixes, airways });
 * const route = resolver.parse('KJFK DCT MERIT J60 MARTN DCT KLAX');
 * const line = routeToLineString(route);
 * if (line) {
 *   map.addSource('route', { type: 'geojson', data: line });
 * }
 * ```
 *
 * @param route - A parsed route from {@link FlightplanResolver.parse}.
 * @returns A GeoJSON `LineString`, or `undefined` if fewer than two points.
 */
export function routeToLineString(route: ParsedRoute): LineString | undefined {
  const points = extractRoutePoints(route);
  if (points.length < 2) {
    return undefined;
  }
  return {
    type: 'LineString',
    coordinates: points.map((p) => [p.lon, p.lat]),
  };
}
