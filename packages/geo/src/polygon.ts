/**
 * Polygon geometry primitives: point-in-polygon ray casting, axis-aligned
 * bounding box computation, and bounding-box containment tests.
 *
 * Polygons are represented as arrays of `[lon, lat]` coordinate pairs forming
 * a closed exterior ring (first and last points identical), matching the
 * GeoJSON convention.
 */

/**
 * Axis-aligned bounding box in decimal degrees. Useful as a fast rejection
 * pre-filter before running a full point-in-polygon test.
 */
export interface BoundingBox {
  /** Minimum longitude. */
  minLon: number;
  /** Maximum longitude. */
  maxLon: number;
  /** Minimum latitude. */
  minLat: number;
  /** Maximum latitude. */
  maxLat: number;
}

/**
 * Tests whether a point is inside a polygon using the ray casting algorithm.
 * The polygon is represented as an array of `[lon, lat]` coordinate pairs
 * forming a closed ring (first and last points are identical).
 *
 * @param x - Longitude of the test point in decimal degrees.
 * @param y - Latitude of the test point in decimal degrees.
 * @param ring - Polygon exterior ring as `[lon, lat]` coordinate pairs.
 * @returns True if the point is inside or on the boundary of the polygon.
 */
export function pointInPolygon(x: number, y: number, ring: number[][]): boolean {
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

/**
 * Computes the axis-aligned bounding box of a polygon exterior ring.
 *
 * An empty ring returns a degenerate "empty" bounding box with
 * `minLon = minLat = Infinity` and `maxLon = maxLat = -Infinity`. Combined
 * with {@link pointInBoundingBox}, such a box rejects every query point,
 * which is the defensively safe behavior for an uninitialized or invalid
 * ring.
 *
 * @param ring - Polygon exterior ring as `[lon, lat]` coordinate pairs.
 * @returns The minimum bounding box enclosing the ring.
 */
export function boundingBox(ring: number[][]): BoundingBox {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const coord of ring) {
    const lon = coord[0]!;
    const lat = coord[1]!;
    if (lon < minLon) {
      minLon = lon;
    }
    if (lon > maxLon) {
      maxLon = lon;
    }
    if (lat < minLat) {
      minLat = lat;
    }
    if (lat > maxLat) {
      maxLat = lat;
    }
  }

  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Tests whether a point falls within an axis-aligned bounding box. Intended as
 * a fast rejection pre-filter before the more expensive {@link pointInPolygon}
 * test.
 *
 * @param lon - Longitude of the test point in decimal degrees.
 * @param lat - Latitude of the test point in decimal degrees.
 * @param box - Bounding box to test against.
 * @returns True if the point is inside or on the edge of the bounding box.
 */
export function pointInBoundingBox(lon: number, lat: number, box: BoundingBox): boolean {
  return lon >= box.minLon && lon <= box.maxLon && lat >= box.minLat && lat <= box.maxLat;
}
