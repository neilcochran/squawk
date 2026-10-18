import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import type { RouteLeg, RoutePoint } from '@squawk/flightplan/browser';

/** MapLibre source id for the plan route leg geometry. */
export const PLAN_ROUTE_SOURCE_ID = 'atlas-plan-route';

/** MapLibre layer id for the legs that may be flown as filed. */
export const PLAN_ROUTE_LINE_LAYER_ID = 'atlas-plan-route-line';

/** MapLibre layer id for the legs that make the route invalid as filed (airway gaps, unusable segments). */
export const PLAN_ROUTE_INVALID_LINE_LAYER_ID = 'atlas-plan-route-invalid-line';

/** MapLibre source id for the plan route waypoints. */
export const PLAN_WAYPOINTS_SOURCE_ID = 'atlas-plan-waypoints';

/** MapLibre layer id for the waypoint dots. */
export const PLAN_WAYPOINTS_LAYER_ID = 'atlas-plan-waypoints-circle';

/** MapLibre layer id for the waypoint identifier labels. */
export const PLAN_WAYPOINTS_LABEL_LAYER_ID = 'atlas-plan-waypoints-label';

/**
 * Whether a leg may be flown as filed: `'valid'`, or `'gap'` when it spans a
 * published discontinuity in the airway it was expanded from, or
 * `'unusable'` when it is an airway segment the FAA marks unusable.
 */
export type PlanLegStatus = 'valid' | 'gap' | 'unusable';

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
  /** Zero-based position of this point along the route. */
  index: number;
}

/**
 * The {@link PlanLegStatus} of one leg. A leg flagged both ways reads as a
 * gap, since the airway does not exist there at all.
 */
export function planLegStatus(leg: Pick<RouteLeg, 'crossesGap' | 'unusable'>): PlanLegStatus {
  if (leg.crossesGap) {
    return 'gap';
  }
  return leg.unusable ? 'unusable' : 'valid';
}

/**
 * Projects the route's legs into a `FeatureCollection` of two-point
 * LineStrings, one per leg, each tagged with its {@link PlanLegStatus} so
 * the map can draw a leg that makes the route invalid as filed differently
 * from the rest. An empty route yields an empty collection, so the source
 * can stay mounted with a stable shape and simply render nothing.
 */
export function toLegCollection(
  legs: readonly RouteLeg[],
): FeatureCollection<LineString, PlanLegFeatureProperties> {
  const features: Feature<LineString, PlanLegFeatureProperties>[] = legs.map((leg) => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [leg.fromLon, leg.fromLat],
        [leg.toLon, leg.toLat],
      ],
    },
    properties: { status: planLegStatus(leg) },
  }));
  return { type: 'FeatureCollection', features };
}

/**
 * Projects the ordered route points into a `FeatureCollection` of labeled
 * Point features for the waypoint dot and label layers. The point order is
 * preserved as the `index` property.
 */
export function toWaypointCollection(
  points: readonly RoutePoint[],
): FeatureCollection<Point, PlanWaypointFeatureProperties> {
  const features: Feature<Point, PlanWaypointFeatureProperties>[] = points.map((point, index) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
    properties: { label: point.label, index },
  }));
  return { type: 'FeatureCollection', features };
}
