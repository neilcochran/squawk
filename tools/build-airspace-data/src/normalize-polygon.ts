import type { Polygon, Position } from 'geojson';

/**
 * Removes consecutive duplicate vertices from every ring of a polygon and
 * keeps each ring closed. Dense source geometry and coordinate rounding can
 * leave two consecutive vertices identical, which some consumers reject as a
 * zero-length edge. A ring that would fall below four positions is returned
 * unchanged.
 */
export function removeDuplicateVertices(polygon: Polygon): Polygon {
  return {
    type: 'Polygon',
    coordinates: polygon.coordinates.map((ring) => dedupeRing(ring)),
  };
}

/**
 * Orients every ring of a polygon as RFC 7946 asks: the exterior ring
 * counterclockwise and any holes clockwise. Ray-casting point-in-polygon
 * tests do not care about winding, but d3-geo and other spherical libraries
 * read a clockwise exterior ring as the complement of the intended area.
 */
export function normalizeWinding(polygon: Polygon): Polygon {
  return {
    type: 'Polygon',
    coordinates: polygon.coordinates.map((ring, index) => {
      const clockwise = signedArea(ring) < 0;
      const wantClockwise = index > 0;
      return clockwise === wantClockwise ? ring : [...ring].reverse();
    }),
  };
}

/**
 * Twice the signed area of a closed ring in the lon/lat plane; positive for
 * a counterclockwise ring. An edge touching a position without two
 * coordinates contributes nothing.
 */
function signedArea(ring: Position[]): number {
  let sum = 0;
  let previous: Position | undefined;
  for (const position of ring) {
    if (previous !== undefined) {
      sum += shoelaceTerm(previous, position);
    }
    previous = position;
  }
  return sum;
}

/**
 * The shoelace term `x1 * y2 - x2 * y1` for the edge from `a` to `b`, or
 * zero when either position lacks a coordinate.
 */
function shoelaceTerm(a: Position, b: Position): number {
  const [x1, y1] = a;
  const [x2, y2] = b;
  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
    return 0;
  }
  return x1 * y2 - x2 * y1;
}

/**
 * Drops consecutive duplicates from a ring, including a last vertex that
 * repeats the first before the closing position, and closes the ring when
 * its last position does not repeat the first.
 */
function dedupeRing(ring: Position[]): Position[] {
  const first = ring[0];
  if (ring.length < 4 || first === undefined) {
    return ring;
  }
  const deduped: Position[] = [first];
  let previous = first;
  for (const position of ring) {
    if (samePosition(previous, position)) {
      continue;
    }
    deduped.push(position);
    previous = position;
  }
  if (!samePosition(previous, first)) {
    deduped.push(first);
  }
  return deduped.length < 4 ? ring : deduped;
}

/**
 * Returns `true` when two positions have identical longitude and latitude.
 */
function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}
