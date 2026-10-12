import { greatCircle } from '@squawk/geo';

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
 * (positive X axis), counterclockwise, in standard Cartesian convention. The
 * FAA's SAA interface description defines the direction of travel by the sign
 * of (endAngleDeg - startAngleDeg): a start angle smaller than the end angle
 * sweeps counterclockwise, a larger one sweeps clockwise, and the angles are
 * not normalized to [0, 360), so the difference is the whole sweep. Equal
 * angles describe a full circle.
 *
 * Points are placed with the great-circle destination formula, so the arc is
 * a true circle on the sphere and meets its adjoining segments at any radius
 * and latitude.
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
  let sweepDeg = endAngleDeg - startAngleDeg;
  if (sweepDeg === 0) {
    sweepDeg = 360;
  }

  const points: [number, number][] = [];
  for (let i = 0; i <= pointCount; i++) {
    const angleDeg = startAngleDeg + (i / pointCount) * sweepDeg;
    // A GML angle is measured counterclockwise from east; a compass bearing
    // is measured clockwise from north.
    const bearingDeg = 90 - angleDeg;
    const { lat, lon } = greatCircle.destination(centerLat, centerLon, bearingDeg, radiusNm);
    points.push([lon, lat]);
  }

  return points;
}
