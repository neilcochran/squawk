/** Bounding box in `[west, south, east, north]` order, lon/lat degrees. */
export type Bbox = [number, number, number, number];

/**
 * Reduces an iterable of `[lon, lat]` pairs to their bounding box in a
 * single pass. Returns undefined when the iterable yields nothing, so
 * callers can branch on the empty case to skip downstream bbox-overlap
 * work entirely.
 *
 * Callers are responsible for filtering undefined or `NaN` entries before
 * yielding; this reducer does not look inside its inputs and is the
 * shared min/max walk used by the inspector's per-shape bbox helpers
 * (`polygonBbox`, `bboxFromWaypoints`, `combinedBboxFromAirspaceFeatures`).
 *
 * @param coords - Iterable of `[lon, lat]` number pairs.
 * @returns The minimal axis-aligned bounding box, or undefined if no
 *          coordinates were yielded.
 */
export function bboxFromCoords(coords: Iterable<readonly [number, number]>): Bbox | undefined {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  let any = false;
  for (const [lon, lat] of coords) {
    if (lon < west) {
      west = lon;
    }
    if (lat < south) {
      south = lat;
    }
    if (lon > east) {
      east = lon;
    }
    if (lat > north) {
      north = lat;
    }
    any = true;
  }
  return any ? [west, south, east, north] : undefined;
}
