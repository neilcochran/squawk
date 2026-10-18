import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import type { RouteLeg, RoutePoint } from '@squawk/flightplan/browser';
import { greatCircle } from '@squawk/geo';

/** MapLibre source id for the plan route leg geometry. */
export const PLAN_ROUTE_SOURCE_ID = 'atlas-plan-route';

/** MapLibre layer id for the legs that may be flown as filed. */
export const PLAN_ROUTE_LINE_LAYER_ID = 'atlas-plan-route-line';

/** MapLibre layer id for the legs that make the route invalid as filed (airway gaps, unusable segments, mismatched procedures). */
export const PLAN_ROUTE_INVALID_LINE_LAYER_ID = 'atlas-plan-route-invalid-line';

/** MapLibre source id for the plan route waypoints. */
export const PLAN_WAYPOINTS_SOURCE_ID = 'atlas-plan-waypoints';

/** MapLibre layer id for the waypoint dots. */
export const PLAN_WAYPOINTS_LAYER_ID = 'atlas-plan-waypoints-circle';

/** MapLibre layer id for the waypoint identifier labels. */
export const PLAN_WAYPOINTS_LABEL_LAYER_ID = 'atlas-plan-waypoints-label';

/**
 * Whether a leg may be flown as filed: `'valid'`, or `'gap'` when it spans a
 * published discontinuity in the airway it was expanded from, `'unusable'`
 * when it is an airway segment the FAA marks unusable, or
 * `'airportMismatch'` when it runs along, or joins the route to, a SID or
 * STAR filed at an airport the procedure does not serve.
 */
export type PlanLegStatus = 'valid' | 'gap' | 'unusable' | 'airportMismatch';

/**
 * Properties carried on each leg line feature in the GeoJSON source.
 */
export interface PlanLegFeatureProperties {
  /** Whether the leg may be flown as filed; the line layers filter on it. */
  status: PlanLegStatus;
}

/**
 * Properties carried on each waypoint point feature in the GeoJSON source.
 */
export interface PlanWaypointFeatureProperties {
  /** Identifier or raw token for the point (e.g. "MERIT", "KJFK"). */
  label: string;
}

/**
 * The {@link PlanLegStatus} of one leg. A leg flagged more than one way reads
 * as the most specific problem: a gap first, since the airway does not exist
 * there at all, then an unusable segment, then a mismatched procedure.
 */
export function planLegStatus(
  leg: Pick<RouteLeg, 'crossesGap' | 'unusable' | 'procedureAirportMismatch'>,
): PlanLegStatus {
  if (leg.crossesGap) {
    return 'gap';
  }
  if (leg.unusable) {
    return 'unusable';
  }
  return leg.procedureAirportMismatch ? 'airportMismatch' : 'valid';
}

/**
 * Shifts a longitude by whole turns so it lies within 180 degrees of the one
 * before it, keeping a path continuous across the antimeridian (`179` then
 * `-179` becomes `179` then `181`). A longitude that needs no shift is
 * returned exactly. MapLibre draws longitudes past 180 into the next world
 * copy, so an unwrapped path renders as one short line instead of a line
 * across the whole map.
 *
 * @param lon - The longitude to unwrap, in decimal degrees.
 * @param previousLon - The path's previous (already unwrapped) longitude, in decimal degrees.
 * @returns `lon` plus the multiple of 360 that puts it nearest `previousLon`.
 */
export function unwrapLongitude(lon: number, previousLon: number): number {
  return lon + 360 * Math.round((previousLon - lon) / 360);
}

/**
 * Longest straight chord a drawn leg is made of, in nautical miles. Short
 * enough that a densified leg reads as the great-circle arc at any zoom, long
 * enough that a 2,000 nm leg stays under a hundred vertices.
 */
export const LEG_ARC_STEP_NM = 25;

/**
 * The `[lon, lat]` vertices that draw one leg as its great-circle arc, at
 * most {@link LEG_ARC_STEP_NM} apart, with longitudes unwrapped from the
 * leg's start so a leg across the antimeridian stays one short line. A leg
 * shorter than the step is just its two endpoints.
 */
function legArcCoordinates(leg: RouteLeg): [number, number][] {
  let previousLon = leg.fromLon;
  return greatCircle
    .densify(leg.fromLat, leg.fromLon, leg.toLat, leg.toLon, LEG_ARC_STEP_NM)
    .map((point): [number, number] => {
      const lon = unwrapLongitude(point.lon, previousLon);
      previousLon = lon;
      return [lon, point.lat];
    });
}

/**
 * Projects the route's legs into a `FeatureCollection` of LineStrings, one
 * per leg, each drawn along its great-circle arc rather than as a straight
 * Mercator line, so a long leg on the map follows the path its distance
 * describes. Each feature is tagged with its {@link PlanLegStatus} so the map
 * can draw a leg that makes the route invalid as filed differently from the
 * rest. An empty route yields an empty collection, so the source can stay
 * mounted with a stable shape and simply render nothing.
 */
export function toLegCollection(
  legs: readonly RouteLeg[],
): FeatureCollection<LineString, PlanLegFeatureProperties> {
  const features: Feature<LineString, PlanLegFeatureProperties>[] = legs.map((leg) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: legArcCoordinates(leg) },
    properties: { status: planLegStatus(leg) },
  }));
  return { type: 'FeatureCollection', features };
}

/**
 * Projects the ordered route points into a `FeatureCollection` of labeled
 * Point features for the waypoint dot and label layers, in route order.
 */
export function toWaypointCollection(
  points: readonly RoutePoint[],
): FeatureCollection<Point, PlanWaypointFeatureProperties> {
  const features: Feature<Point, PlanWaypointFeatureProperties>[] = points.map((point) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
    properties: { label: point.label },
  }));
  return { type: 'FeatureCollection', features };
}
