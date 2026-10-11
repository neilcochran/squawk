import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import type { RoutePoint } from '@squawk/flightplan/browser';

/** MapLibre source id for the plan route line geometry. */
export const PLAN_ROUTE_SOURCE_ID = 'atlas-plan-route';

/** MapLibre layer id for the route line. */
export const PLAN_ROUTE_LINE_LAYER_ID = 'atlas-plan-route-line';

/** MapLibre source id for the plan route waypoints. */
export const PLAN_WAYPOINTS_SOURCE_ID = 'atlas-plan-waypoints';

/** MapLibre layer id for the waypoint dots. */
export const PLAN_WAYPOINTS_LAYER_ID = 'atlas-plan-waypoints-circle';

/** MapLibre layer id for the waypoint identifier labels. */
export const PLAN_WAYPOINTS_LABEL_LAYER_ID = 'atlas-plan-waypoints-label';

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
 * Wraps the route LineString in a single-feature `FeatureCollection` for a
 * MapLibre `geojson` source. Returns an empty collection when the route has
 * no drawable line (fewer than two points), so the source can stay mounted
 * with a stable shape and simply render nothing.
 */
export function toRouteLineCollection(line: LineString | undefined): FeatureCollection<LineString> {
  if (line === undefined) {
    return { type: 'FeatureCollection', features: [] };
  }
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: line, properties: {} }],
  };
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
