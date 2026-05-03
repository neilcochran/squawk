import type { Polygon } from 'geojson';

import type { BoundingBox } from '@squawk/geo';
import type { AirspaceFeature } from '@squawk/types';

/**
 * Re-export of {@link @squawk/geo!BoundingBox} so inspector modules can
 * import their bbox shape from the same `./geometry.ts` they import the
 * helpers from, without each one having to take a direct geo import for
 * the type alone.
 */
export type { BoundingBox } from '@squawk/geo';

/**
 * Reduces an iterable of `[lon, lat]` pairs to their bounding box in a
 * single pass. Returns undefined when the iterable yields nothing, so
 * callers can branch on the empty case to skip downstream bbox-overlap
 * work entirely.
 *
 * Callers are responsible for filtering undefined or `NaN` entries before
 * yielding; this reducer does not look inside its inputs and is the
 * shared min/max walk used by the inspector's per-shape bbox helpers
 * (`bboxFromWaypoints`, `combinedBboxFromAirspaceFeatures`). The polygon
 * case is covered directly by `polygonGeoJson.polygonBoundingBox` from
 * `@squawk/geo`.
 *
 * @param coords - Iterable of `[lon, lat]` number pairs.
 * @returns The minimal axis-aligned bounding box, or undefined if no
 *          coordinates were yielded.
 */
export function bboxFromCoords(
  coords: Iterable<readonly [number, number]>,
): BoundingBox | undefined {
  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let any = false;
  for (const [lon, lat] of coords) {
    if (lon < minLon) {
      minLon = lon;
    }
    if (lat < minLat) {
      minLat = lat;
    }
    if (lon > maxLon) {
      maxLon = lon;
    }
    if (lat > maxLat) {
      maxLat = lat;
    }
    any = true;
  }
  return any ? { minLon, maxLon, minLat, maxLat } : undefined;
}

/**
 * Bounding box from an airway's ordered list of waypoints.
 * Returns undefined when the waypoint list is empty.
 */
export function bboxFromWaypoints(
  waypoints: readonly { lat: number; lon: number }[],
): BoundingBox | undefined {
  return bboxFromCoords(coordsOfWaypoints(waypoints));
}

/**
 * Combined bounding box across every feature in an airspace grouping.
 * A Class B has multiple ring features; an ARTCC has multiple strata.
 * The combined bbox is the smallest rectangle that contains all of
 * them. Returns undefined if no feature has any coordinates.
 */
export function combinedBboxFromAirspaceFeatures(
  features: readonly AirspaceFeature[],
): BoundingBox | undefined {
  return bboxFromCoords(coordsOfAirspaceFeatures(features));
}

/** Yields each waypoint as a `[lon, lat]` pair for the bbox reducer. */
function* coordsOfWaypoints(
  waypoints: readonly { lat: number; lon: number }[],
): Generator<readonly [number, number]> {
  for (const wp of waypoints) {
    yield [wp.lon, wp.lat];
  }
}

/** Yields every defined `[lon, lat]` pair across a list of airspace feature boundaries. */
function* coordsOfAirspaceFeatures(
  features: readonly AirspaceFeature[],
): Generator<readonly [number, number]> {
  for (const feature of features) {
    yield* coordsOfPolygon(feature.boundary);
  }
}

/**
 * Yields every defined `[lon, lat]` pair across all rings of a polygon.
 * GeoJSON's `Position` is typed as `number[]`, so the inner coords can
 * be shorter than two elements at the type level; entries with an
 * undefined lon or lat are skipped. Exported so the chart-mode click
 * geometry helpers can reuse it without re-importing the geojson type.
 */
export function* coordsOfPolygon(polygon: Polygon): Generator<readonly [number, number]> {
  for (const ring of polygon.coordinates) {
    for (const coord of ring) {
      const lon = coord[0];
      const lat = coord[1];
      if (lon === undefined || lat === undefined) {
        continue;
      }
      yield [lon, lat];
    }
  }
}
