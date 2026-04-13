/**
 * Default number of points to generate per arc segment. 64 points produces
 * smooth curves at any airspace scale while keeping output file size reasonable.
 */
const DEFAULT_POINT_COUNT = 64;

/**
 * Converts a GML ArcByCenterPoint segment into an array of [lon, lat] coordinate
 * pairs that approximate the arc as a polyline.
 *
 * GML ArcByCenterPoint angles are measured in degrees from the east direction
 * (positive X axis), counterclockwise, in standard Cartesian convention. The arc
 * sweeps counterclockwise from startAngleDeg to endAngleDeg. If endAngleDeg is
 * less than or equal to startAngleDeg the arc wraps counterclockwise past 360.
 *
 * Coordinates use a flat-earth approximation which is accurate to well within
 * 0.1 NM across the sizes of any US airspace feature.
 */
export function discretizeArc(
  /** Center point longitude in decimal degrees (WGS84). */
  centerLon: number,
  /** Center point latitude in decimal degrees (WGS84). */
  centerLat: number,
  /** Arc radius in nautical miles. */
  radiusNm: number,
  /** Start angle in degrees from east, counterclockwise. */
  startAngleDeg: number,
  /** End angle in degrees from east, counterclockwise. */
  endAngleDeg: number,
  /** Number of points to generate along the arc. */
  pointCount: number = DEFAULT_POINT_COUNT,
): [number, number][] {
  // 1 NM = 1/60 degree of latitude (constant).
  const radiusLatDeg = radiusNm / 60;

  // Longitude degrees per NM varies with latitude due to meridian convergence.
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const radiusLonDeg = cosLat !== 0 ? radiusLatDeg / cosLat : radiusLatDeg;

  // Normalise the sweep so we always go counterclockwise (increasing angle).
  let end = endAngleDeg;
  if (end <= startAngleDeg) {
    end += 360;
  }
  const totalDeg = end - startAngleDeg;

  const points: [number, number][] = [];
  for (let i = 0; i <= pointCount; i++) {
    const angleDeg = startAngleDeg + (i / pointCount) * totalDeg;
    const angleRad = (angleDeg * Math.PI) / 180;
    const lon = centerLon + Math.cos(angleRad) * radiusLonDeg;
    const lat = centerLat + Math.sin(angleRad) * radiusLatDeg;
    points.push([lon, lat]);
  }

  return points;
}
