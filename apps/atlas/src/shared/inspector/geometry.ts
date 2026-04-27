import type { BoundingBox } from '@squawk/geo';

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
