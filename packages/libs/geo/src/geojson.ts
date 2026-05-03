/**
 * GeoJSON-shape polygon helpers. These accept `geojson.Polygon` directly,
 * so callers working with maplibre/turf-style features do not have to
 * unpack rings into `number[][]` first. The raw-coordinates API in
 * {@link ./polygon.js} remains the right level for indexing-heavy paths
 * (e.g. `@squawk/airspace`); these helpers are for app-level rendering
 * and selection logic.
 */

import type { Polygon } from 'geojson';

import type { BoundingBox } from './polygon.js';

/**
 * Tests whether a point lies inside a polygon, treating the first ring
 * as the outer boundary and any subsequent rings as holes (a point
 * inside a hole is outside the polygon).
 *
 * Standard ray-casting algorithm: count edge crossings on a horizontal
 * ray to the right of the point. Behavior on a boundary vertex is
 * algorithm-dependent and not specified.
 *
 * @param point - Test point as `[lon, lat]`.
 * @param polygon - GeoJSON Polygon.
 * @returns `true` when the point is inside the outer ring and not inside
 *          any hole.
 */
export function pointInPolygon(point: readonly [number, number], polygon: Polygon): boolean {
  let inside = false;
  for (let r = 0; r < polygon.coordinates.length; r++) {
    const ring = polygon.coordinates[r];
    if (ring === undefined || ring.length === 0) {
      continue;
    }
    let ringInside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i++) {
      const a = ring[i];
      const b = ring[j];
      if (a === undefined || b === undefined) {
        continue;
      }
      const xi = a[0];
      const yi = a[1];
      const xj = b[0];
      const yj = b[1];
      if (xi === undefined || yi === undefined || xj === undefined || yj === undefined) {
        continue;
      }
      if (yi > point[1] !== yj > point[1]) {
        const xIntersect = ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
        if (point[0] < xIntersect) {
          ringInside = !ringInside;
        }
      }
    }
    if (r === 0) {
      inside = ringInside;
    } else if (ringInside) {
      inside = false;
    }
  }
  return inside;
}

/**
 * Computes the centroid of a polygon as the arithmetic mean of its
 * outer-ring vertices. For non-convex shapes this point is not guaranteed
 * to lie inside the polygon, but it is a deterministic, dataset-stable
 * label position.
 *
 * Returns `undefined` when the outer ring is missing or yields no usable
 * coordinates - the caller can use this signal to skip downstream work
 * rather than receive a `[NaN, NaN]` sentinel.
 *
 * @param polygon - GeoJSON Polygon.
 * @returns Mean `[lon, lat]` of the outer ring, or `undefined` if the
 *          ring is empty.
 */
export function polygonCentroid(polygon: Polygon): [number, number] | undefined {
  const ring = polygon.coordinates[0];
  if (ring === undefined || ring.length === 0) {
    return undefined;
  }
  let lonSum = 0;
  let latSum = 0;
  let count = 0;
  for (const coord of ring) {
    const lon = coord[0];
    const lat = coord[1];
    if (lon === undefined || lat === undefined) {
      continue;
    }
    lonSum += lon;
    latSum += lat;
    count++;
  }
  return count === 0 ? undefined : [lonSum / count, latSum / count];
}

/**
 * Computes the axis-aligned bounding box of a polygon across every ring
 * (outer and holes). Holes do not shrink the box - this is the smallest
 * rectangle that contains all of the polygon's geometry.
 *
 * An empty polygon (no coordinates) returns a degenerate box with
 * `minLon = minLat = Infinity` and `maxLon = maxLat = -Infinity`.
 * Combined with {@link pointInBoundingBox}, such a box rejects every
 * query point - the same defensive behavior as
 * {@link ./polygon.js#boundingBox}.
 *
 * @param polygon - GeoJSON Polygon.
 * @returns The minimum bounding box enclosing every ring.
 */
export function polygonBoundingBox(polygon: Polygon): BoundingBox {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const ring of polygon.coordinates) {
    for (const coord of ring) {
      const lon = coord[0];
      const lat = coord[1];
      if (lon === undefined || lat === undefined) {
        continue;
      }
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
  }
  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Coordinate-by-coordinate equality across two polygons. Two polygons
 * are identical when they have the same number of rings, each ring has
 * the same number of vertices, and every `[lon, lat]` pair matches by
 * strict equality.
 *
 * Useful for catching same-lateral-airspace-at-different-altitudes
 * scenarios where two `Polygon` records share boundary geometry exactly.
 *
 * @param a - First polygon.
 * @param b - Second polygon.
 * @returns `true` when the polygons are vertex-for-vertex identical.
 */
export function polygonsIdentical(a: Polygon, b: Polygon): boolean {
  if (a.coordinates.length !== b.coordinates.length) {
    return false;
  }
  for (let r = 0; r < a.coordinates.length; r++) {
    const ringA = a.coordinates[r];
    const ringB = b.coordinates[r];
    if (ringA === undefined || ringB === undefined) {
      return false;
    }
    if (ringA.length !== ringB.length) {
      return false;
    }
    for (let i = 0; i < ringA.length; i++) {
      const ca = ringA[i];
      const cb = ringB[i];
      if (ca === undefined || cb === undefined) {
        return false;
      }
      if (ca[0] !== cb[0] || ca[1] !== cb[1]) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Tests whether two polygons substantially overlap using a bidirectional
 * centroid heuristic: identical polygons always count, and otherwise the
 * two are considered overlapping iff `a`'s centroid lies inside `b` OR
 * `b`'s centroid lies inside `a`. This catches small-feature-inside-big
 * and big-feature-inside-small without computing actual intersection
 * area.
 *
 * The caller may pass `aCentroid` when it has already been computed (the
 * common case in viewport-aware filters), letting this function skip a
 * redundant centroid pass over `a`.
 *
 * @param a - First polygon.
 * @param b - Second polygon.
 * @param aCentroid - Optional pre-computed centroid of `a` to avoid
 *                    recomputation.
 * @returns `true` when the polygons overlap by the heuristic above.
 */
export function polygonsSubstantiallyOverlap(
  a: Polygon,
  b: Polygon,
  aCentroid?: readonly [number, number],
): boolean {
  if (polygonsIdentical(a, b)) {
    return true;
  }
  const candidateA = aCentroid ?? polygonCentroid(a);
  if (candidateA !== undefined && pointInPolygon(candidateA, b)) {
    return true;
  }
  const candidateB = polygonCentroid(b);
  if (candidateB !== undefined && pointInPolygon(candidateB, a)) {
    return true;
  }
  return false;
}

/**
 * Standard 2D AABB intersection test. Touching boxes (sharing an edge)
 * count as overlapping.
 *
 * @param a - First bounding box.
 * @param b - Second bounding box.
 * @returns `true` when the boxes intersect or touch.
 */
export function boundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.minLon <= b.maxLon && b.minLon <= a.maxLon && a.minLat <= b.maxLat && b.minLat <= a.maxLat
  );
}

/**
 * Tests whether a point lies inside (or on the boundary of) a bounding
 * box. Tuple-shape sibling to {@link ./polygon.js#pointInBoundingBox},
 * which takes separate `lon, lat` arguments and is intended for hot-path
 * callers where the unpacked form avoids tuple allocation.
 *
 * @param point - Test point as `[lon, lat]`.
 * @param bbox - Bounding box to test against.
 * @returns `true` when the point is inside or on the edge of `bbox`.
 */
export function pointInBoundingBox(point: readonly [number, number], bbox: BoundingBox): boolean {
  return (
    point[0] >= bbox.minLon &&
    point[0] <= bbox.maxLon &&
    point[1] >= bbox.minLat &&
    point[1] <= bbox.maxLat
  );
}
