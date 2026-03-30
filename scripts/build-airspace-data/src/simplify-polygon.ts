import type { Polygon } from 'geojson';

/**
 * Simplifies a GeoJSON Polygon using the Douglas-Peucker algorithm. Reduces
 * coordinate density while preserving the overall shape. Points are kept if
 * they deviate from the straight line between their neighbors by more than
 * the given tolerance (in the same units as the coordinates, i.e. degrees).
 *
 * The first and last coordinates of each ring are always preserved to
 * maintain ring closure. If simplification would reduce a ring below 4
 * coordinates (the GeoJSON minimum for a valid polygon), the ring is left
 * unchanged.
 */
export function simplifyPolygon(
  /** The polygon to simplify. */
  polygon: Polygon,
  /** Maximum deviation tolerance in degrees. A value of 0.0001 is roughly 11 meters. */
  tolerance: number,
): Polygon {
  return {
    type: 'Polygon',
    coordinates: polygon.coordinates.map((ring) => simplifyRing(ring, tolerance)),
  };
}

/**
 * Applies Douglas-Peucker simplification to a single coordinate ring.
 * Returns the original ring if the simplified result would have fewer than
 * 4 points (the minimum for a valid GeoJSON polygon ring).
 */
function simplifyRing(ring: number[][], tolerance: number): number[][] {
  if (ring.length < 4) return ring;

  const simplified = douglasPeucker(ring, 0, ring.length - 1, tolerance);
  // 4 is the GeoJSON minimum: 3 distinct vertices + closing duplicate.
  if (simplified.length < 4) return ring;
  return simplified;
}

/**
 * Recursive Douglas-Peucker implementation. Returns the simplified set of
 * points between indices start and end (inclusive) of the input array.
 */
function douglasPeucker(
  points: number[][],
  start: number,
  end: number,
  tolerance: number,
): number[][] {
  if (end - start < 2) {
    return [points[start]!, points[end]!];
  }

  let maxDist = 0;
  let maxIdx = start;

  const ax = points[start]![0]!;
  const ay = points[start]![1]!;
  const bx = points[end]![0]!;
  const by = points[end]![1]!;

  for (let i = start + 1; i < end; i++) {
    const d = perpendicularDistance(points[i]![0]!, points[i]![1]!, ax, ay, bx, by);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist <= tolerance) {
    return [points[start]!, points[end]!];
  }

  const left = douglasPeucker(points, start, maxIdx, tolerance);
  const right = douglasPeucker(points, maxIdx, end, tolerance);

  // Remove the duplicate point at the join (maxIdx appears at end of left and start of right).
  return left.concat(right.slice(1));
}

/**
 * Computes the perpendicular distance from point (px, py) to the line
 * segment defined by (ax, ay) to (bx, by). All values are in degrees;
 * at the scales involved (< 1 degree segments) the Euclidean approximation
 * is sufficient.
 */
function perpendicularDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Degenerate segment: distance to the single point.
    const ex = px - ax;
    const ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }

  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / Math.sqrt(lengthSq);
}
