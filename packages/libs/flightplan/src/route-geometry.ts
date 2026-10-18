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
   * nautical miles, when the source data publishes a positive value.
   */
  precomputedDistanceToNextNm?: number;
  /**
   * Set when the leg from this point to the next crosses a published gap in
   * the airway it was expanded from.
   */
  gapToNext?: true;
  /**
   * Set when the leg from this point to the next is an airway segment the FAA
   * marks unusable.
   */
  unusableToNext?: true;
  /**
   * Set when the leg from this point to the next runs along, or joins the
   * route to, a SID or STAR filed at an airport no adaptation of it serves.
   */
  procedureMismatchToNext?: true;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Epsilon in decimal degrees for treating two consecutive points as the same
 * position. The data packages round coordinates to different precisions
 * (airway waypoints to six decimals, fixes and navaids to eight), so the same
 * fix reached through two of them can differ by up to 5e-7 degrees. 1e-5
 * degrees is about a metre: far above that rounding noise and far below the
 * spacing of any two distinct route points.
 */
const COORD_EPSILON = 1e-5;

/**
 * Returns true if two points share the same coordinates (within epsilon).
 */
function samePosition(a: GeoPoint, b: GeoPoint): boolean {
  return Math.abs(a.lat - b.lat) < COORD_EPSILON && Math.abs(a.lon - b.lon) < COORD_EPSILON;
}

/**
 * Walks the route elements and extracts an ordered array of geographic
 * points. Duplicate consecutive points (e.g. an airway entry fix at the same
 * position as the preceding waypoint, within about a metre) are suppressed.
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
      // Likewise carry a gap, unusable or procedure-mismatch marker, so the
      // leg out of the merged point is still reported.
      if (point.gapToNext) {
        last.gapToNext = true;
      }
      if (point.unusableToNext) {
        last.unusableToNext = true;
      }
      if (point.procedureMismatchToNext) {
        last.procedureMismatchToNext = true;
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

      case 'airway': {
        const gapIndexes = new Set(el.gaps.map((gap) => gap.index));
        const unusableIndexes = new Set(el.unusable.map((segment) => segment.index));
        for (let i = 0; i < el.waypoints.length; i++) {
          const wp = el.waypoints[i]!;
          const isLast = i === el.waypoints.length - 1;
          const point: GeoPoint = {
            label: wp.identifier ?? wp.name,
            lat: wp.lat,
            lon: wp.lon,
          };
          // The published distance of the leg to the next waypoint sits on
          // whichever of the two starts the segment in the airway's published
          // order: this waypoint when the airway is flown forward, the next one
          // when it is flown in reverse. When the direction is unknown the leg
          // is measured as a great circle. Only a positive distance is used: a
          // zero means the source published none.
          const segmentStart = isLast
            ? undefined
            : el.reversed === false
              ? wp
              : el.reversed === true
                ? el.waypoints[i + 1]
                : undefined;
          const published = segmentStart?.distanceToNextNm;
          if (published !== undefined && published > 0) {
            point.precomputedDistanceToNextNm = published;
          }
          if (!isLast && gapIndexes.has(i)) {
            point.gapToNext = true;
          }
          if (!isLast && unusableIndexes.has(i)) {
            point.unusableToNext = true;
          }
          emit(point);
        }
        break;
      }

      case 'sid':
      case 'star': {
        // A procedure filed at an airport it does not serve flags its own legs
        // and the leg joining it to that airport: the leg in from the
        // departure for a SID, the leg out to the arrival for a STAR.
        const mismatched = el.airportMismatch !== undefined;
        if (mismatched && el.type === 'sid' && points.length > 0) {
          points[points.length - 1]!.procedureMismatchToNext = true;
        }
        const drawable = el.legs.flatMap((leg): GeoPoint[] =>
          leg.fixIdentifier !== undefined && leg.lat !== undefined && leg.lon !== undefined
            ? [{ label: leg.fixIdentifier, lat: leg.lat, lon: leg.lon }]
            : [],
        );
        drawable.forEach((point, index) => {
          if (mismatched && (el.type === 'star' || index < drawable.length - 1)) {
            point.procedureMismatchToNext = true;
          }
          emit(point);
        });
        break;
      }

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
 * const route = resolver.parse('KLAX DCT LAX J60 SAX DCT KJFK');
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
 * const route = resolver.parse('KLAX DCT LAX J60 SAX DCT KJFK');
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
