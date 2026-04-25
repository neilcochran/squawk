/**
 * A `[lon, lat]` coordinate pair in decimal degrees, matching the GeoJSON
 * convention used throughout the airspace pipeline.
 */
type LonLat = [number, number];

/**
 * Splits a closed polygon ring into one or more closed rings such that every
 * output ring lies entirely within the standard `[-180, 180]` longitude range.
 *
 * The algorithm:
 *
 * 1. Detect antimeridian crossings by looking for consecutive vertices whose
 *    longitudes differ by more than 180 degrees. The natural interpretation
 *    of such a jump is that the polygon edge wraps around the 180th meridian
 *    rather than taking the long way around the globe.
 * 2. Apply a cumulative longitude shift so the ring becomes continuous in a
 *    shifted longitude space (e.g. an Oakland Oceanic ring originally
 *    spanning `162E -> -176W` becomes continuous at `162 -> 184`).
 * 3. Identify which 360-wide "wedges" centered on multiples of 360 the
 *    shifted ring overlaps. A ring entirely within one wedge needs only a
 *    final coordinate shift back to `[-180, 180]`. A ring that spans two
 *    wedges is clipped at the wedge boundary (the antimeridian) using a
 *    Sutherland-Hodgman style polygon clip and emitted as two sub-rings.
 *
 * Input rings should be closed (first vertex equals last vertex). Output
 * rings are also closed. Degenerate output rings (fewer than 4 vertices
 * after re-closing) are dropped.
 *
 * The function is geometry-only - it does not touch coordinate precision or
 * winding direction.
 */
export function splitAtAntimeridian(
  /** A closed polygon ring (first vertex equals last vertex). */
  ring: LonLat[],
): LonLat[][] {
  if (ring.length < 4) {
    return [];
  }

  // Strip the closing duplicate; we will re-close every output ring at the end.
  const open = stripClosingDuplicate(ring);
  if (open.length < 3) {
    return [];
  }

  if (!hasAntimeridianCrossing(open)) {
    return [closeRing(open)];
  }

  const shifted = applyCumulativeShift(open);
  const minLon = shifted.reduce((acc, [lon]) => Math.min(acc, lon), Infinity);
  const maxLon = shifted.reduce((acc, [lon]) => Math.max(acc, lon), -Infinity);

  // Wedge index k covers shifted longitudes [k * 360 - 180, k * 360 + 180].
  // Wedge 0 is the standard [-180, 180]; wedge 1 covers [180, 540]; wedge -1 covers [-540, -180].
  const minWedge = Math.floor((minLon + 180) / 360);
  const maxWedge = Math.floor((maxLon + 180) / 360);

  if (minWedge === maxWedge) {
    const offset = minWedge * 360;
    return [closeRing(shifted.map(([lon, lat]): LonLat => [lon - offset, lat]))];
  }

  const subRings: LonLat[][] = [];
  for (let k = minWedge; k <= maxWedge; k++) {
    const wedgeLeft = k * 360 - 180;
    const wedgeRight = k * 360 + 180;
    const clipped = clipToVerticalStrip(shifted, wedgeLeft, wedgeRight);
    if (clipped.length < 3) {
      continue;
    }
    const offset = k * 360;
    const mapped = clipped.map(([lon, lat]): LonLat => [lon - offset, lat]);
    subRings.push(closeRing(mapped));
  }
  return subRings;
}

/**
 * Returns a copy of the ring with its trailing closing-duplicate vertex
 * removed, if present. Leaves the ring unchanged when the first and last
 * vertices already differ.
 */
function stripClosingDuplicate(ring: LonLat[]): LonLat[] {
  if (ring.length < 2) {
    return ring.slice();
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }
  return ring.slice();
}

/**
 * Re-closes an open ring by appending a copy of the first vertex when the
 * last vertex differs from it. GeoJSON requires polygon rings to be closed.
 */
function closeRing(open: LonLat[]): LonLat[] {
  if (open.length === 0) {
    return [];
  }
  const first = open[0]!;
  const last = open[open.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) {
    return open.slice();
  }
  return [...open, [first[0], first[1]]];
}

/**
 * Returns true when the ring contains at least one consecutive-vertex pair
 * whose longitudes differ by more than 180 degrees, indicating an
 * antimeridian crossing.
 */
function hasAntimeridianCrossing(open: LonLat[]): boolean {
  for (let i = 0; i < open.length; i++) {
    const prevLon = open[(i - 1 + open.length) % open.length]?.[0];
    const currLon = open[i]?.[0];
    if (prevLon === undefined || currLon === undefined) {
      continue;
    }
    if (Math.abs(currLon - prevLon) > 180) {
      return true;
    }
  }
  return false;
}

/**
 * Walks the open ring and returns a copy where every vertex's longitude has
 * been adjusted by a cumulative ±360 offset so the resulting sequence has
 * no antimeridian jumps. The starting vertex is unchanged; subsequent
 * vertices are shifted to stay within 180 degrees of their predecessor.
 */
function applyCumulativeShift(open: LonLat[]): LonLat[] {
  const shifted: LonLat[] = [];
  let cumShift = 0;
  const first = open[0]!;
  shifted.push([first[0], first[1]]);
  for (let i = 1; i < open.length; i++) {
    const prevRawLon = open[i - 1]![0];
    const curr = open[i]!;
    const dLon = curr[0] - prevRawLon;
    if (dLon > 180) {
      cumShift -= 360;
    } else if (dLon < -180) {
      cumShift += 360;
    }
    shifted.push([curr[0] + cumShift, curr[1]]);
  }
  return shifted;
}

/**
 * Clips an open polygon ring against a vertical strip defined by two
 * longitudes using a Sutherland-Hodgman style algorithm. Vertices are
 * processed pairwise (each vertex paired with its predecessor, with the
 * first vertex paired with the last so the closing edge is included).
 *
 * Returns the clipped polygon's vertices in the same order as the input,
 * without a closing duplicate. The result is empty if the polygon does not
 * intersect the strip.
 */
function clipToVerticalStrip(open: LonLat[], leftLon: number, rightLon: number): LonLat[] {
  let work = open.slice();
  work = clipAgainstVerticalLine(work, rightLon, true);
  work = clipAgainstVerticalLine(work, leftLon, false);
  return work;
}

/**
 * Clips an open polygon against a single vertical line. When `keepLeft` is
 * true the clipping retains the half-plane `lon <= lineLon`; otherwise it
 * retains `lon >= lineLon`. Edges that cross the line have an interpolated
 * vertex inserted at the crossing.
 */
function clipAgainstVerticalLine(open: LonLat[], lineLon: number, keepLeft: boolean): LonLat[] {
  if (open.length === 0) {
    return [];
  }

  const result: LonLat[] = [];
  for (let i = 0; i < open.length; i++) {
    const curr = open[i]!;
    const prev = open[(i - 1 + open.length) % open.length]!;

    const currInside = isInside(curr[0], lineLon, keepLeft);
    const prevInside = isInside(prev[0], lineLon, keepLeft);

    if (currInside) {
      if (!prevInside) {
        result.push(intersectAtLine(prev, curr, lineLon));
      }
      result.push([curr[0], curr[1]]);
    } else if (prevInside) {
      result.push(intersectAtLine(prev, curr, lineLon));
    }
  }
  return result;
}

/**
 * Returns whether the given longitude is on the kept side of the clipping
 * line. The boundary itself is treated as inside, which matches the GeoJSON
 * convention that polygons include their boundary.
 */
function isInside(lon: number, lineLon: number, keepLeft: boolean): boolean {
  return keepLeft ? lon <= lineLon : lon >= lineLon;
}

/**
 * Computes the linearly interpolated vertex where the segment from `a` to
 * `b` crosses the vertical line at `lineLon`. Assumes `a.lon !== b.lon`;
 * the caller is responsible for not invoking this for vertical segments
 * that lie exactly on the line.
 */
function intersectAtLine(a: LonLat, b: LonLat, lineLon: number): LonLat {
  const t = (lineLon - a[0]) / (b[0] - a[0]);
  const lat = a[1] + t * (b[1] - a[1]);
  return [lineLon, lat];
}
