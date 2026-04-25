/**
 * A `[lon, lat]` coordinate pair in decimal degrees, matching the GeoJSON
 * Position convention used throughout the airspace build pipeline.
 */
export type LonLat = [number, number];

/**
 * Returns a closed copy of a polygon ring. If the first and last vertices
 * already match, the ring is returned as a shallow copy unchanged. If they
 * differ, a copy of the first vertex is appended so the result satisfies
 * the GeoJSON requirement that polygon rings be closed (first vertex
 * identical to last). An empty input yields an empty output.
 *
 * @param ring - The polygon ring to close.
 * @returns A closed copy of the ring.
 */
export function closeRing(ring: LonLat[]): LonLat[] {
  if (ring.length === 0) {
    return [];
  }
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring.slice();
  }
  return [...ring, [first[0], first[1]]];
}

/**
 * Returns a copy of the ring with its trailing closing-duplicate vertex
 * removed when the first and last vertices match. Leaves the ring
 * unchanged when they already differ. Useful when a downstream algorithm
 * needs to walk the unique vertices without revisiting the start point.
 *
 * @param ring - The polygon ring to open.
 * @returns A shallow copy of the ring without its closing duplicate.
 */
export function stripClosingDuplicate(ring: LonLat[]): LonLat[] {
  if (ring.length < 2) {
    return ring.slice();
  }
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }
  return ring.slice();
}
