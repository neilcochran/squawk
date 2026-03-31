/**
 * Tests whether a point is inside a polygon using the ray casting algorithm.
 * The polygon is represented as an array of [lon, lat] coordinate pairs
 * forming a closed ring (first and last points are identical).
 *
 * Returns true if the point is inside or on the boundary of the polygon.
 */
export function pointInPolygon(
  /** Longitude of the test point in decimal degrees. */
  x: number,
  /** Latitude of the test point in decimal degrees. */
  y: number,
  /** Polygon exterior ring as [lon, lat] coordinate pairs. */
  ring: number[][],
): boolean {
  let inside = false;
  const len = ring.length;

  for (let i = 0, j = len - 1; i < len; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}
