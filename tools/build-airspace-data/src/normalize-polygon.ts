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
 * a counterclockwise ring.
 */
function signedArea(ring: Position[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i] ?? [];
    const [x2, y2] = ring[i + 1] ?? [];
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
      continue;
    }
    sum += x1 * y2 - x2 * y1;
  }
  return sum;
}

/**
 * Drops consecutive duplicates from a closed ring, including a last vertex
 * that repeats the first before the closing position, and re-closes it.
 */
function dedupeRing(ring: Position[]): Position[] {
  if (ring.length < 4) {
    return ring;
  }
  const deduped: Position[] = [];
  for (const position of ring) {
    const previous = deduped[deduped.length - 1];
    if (previous !== undefined && samePosition(previous, position)) {
      continue;
    }
    deduped.push(position);
  }
  const first = deduped[0];
  while (
    deduped.length > 1 &&
    first !== undefined &&
    samePosition(deduped[deduped.length - 1] ?? [], first)
  ) {
    deduped.pop();
  }
  if (first !== undefined) {
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
