import type { Position } from 'geojson';

import type { AirwayWaypoint } from '@squawk/types';

/**
 * Builds the per-airway segment list, splitting at the antimeridian when
 * consecutive waypoints lie on opposite sides of lon=180. The split uses
 * linear interpolation of the latitude at the crossing, which is good
 * enough for visual rendering on a Mercator-style projection.
 *
 * Without this split, MapLibre draws Pacific routes (Alaska <-> Asia
 * <-> Hawaii) the long way around the globe instead of across the
 * antimeridian. Returns one or more `Position[]` segments; with no
 * antimeridian crossings the result is a single segment containing
 * every waypoint.
 *
 * Lives in its own module (rather than alongside `AirwaysLayer`) so the
 * `.tsx` layer file only exports its component, keeping React Fast
 * Refresh / HMR happy.
 */
export function buildSegments(waypoints: AirwayWaypoint[]): Position[][] {
  const segments: Position[][] = [];
  let current: Position[] = [];
  let prev: AirwayWaypoint | undefined;

  for (const wp of waypoints) {
    if (prev === undefined) {
      current.push([wp.lon, wp.lat]);
      prev = wp;
      continue;
    }

    const lonDiff = wp.lon - prev.lon;
    if (Math.abs(lonDiff) > 180) {
      // The two waypoints are on opposite sides of the antimeridian and the
      // shorter physical path crosses it. Close the current segment at the
      // crossing point, then start a new segment from the wrap on the other
      // side.
      const prevSideCrossingLon = lonDiff > 0 ? -180 : 180;
      const wpSideCrossingLon = lonDiff > 0 ? 180 : -180;
      const wpAdjustedLon = lonDiff > 0 ? wp.lon - 360 : wp.lon + 360;
      const t = (prevSideCrossingLon - prev.lon) / (wpAdjustedLon - prev.lon);
      const crossingLat = prev.lat + t * (wp.lat - prev.lat);

      current.push([prevSideCrossingLon, crossingLat]);
      segments.push(current);
      current = [
        [wpSideCrossingLon, crossingLat],
        [wp.lon, wp.lat],
      ];
    } else {
      current.push([wp.lon, wp.lat]);
    }
    prev = wp;
  }

  segments.push(current);
  return segments;
}
