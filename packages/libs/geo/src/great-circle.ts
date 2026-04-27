/**
 * Great-circle geometry: distance, initial bearing, midpoint, and destination
 * point on a spherical Earth model using the Haversine and related formulas.
 *
 * All latitude and longitude inputs are in decimal degrees (WGS84, positive
 * north and east). Bearings are degrees true in the range [0, 360).
 */

import type { Coordinates } from '@squawk/types';
import { angle } from '@squawk/units';

/** Mean radius of the Earth in nautical miles. */
const EARTH_RADIUS_NM = 3440.065;

/**
 * Normalizes an angle to the range [0, 360).
 *
 * @param deg - Angle in degrees.
 * @returns Angle normalized to 0-360.
 */
function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Computes the great-circle distance in nautical miles between two geographic
 * positions using the Haversine formula.
 *
 * @param lat1 - Latitude of the first point in decimal degrees.
 * @param lon1 - Longitude of the first point in decimal degrees.
 * @param lat2 - Latitude of the second point in decimal degrees.
 * @param lon2 - Longitude of the second point in decimal degrees.
 * @returns Distance in nautical miles.
 */
export function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = angle.degreesToRadians(lat2 - lat1);
  const dLon = angle.degreesToRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(angle.degreesToRadians(lat1)) *
      Math.cos(angle.degreesToRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_NM * c;
}

/**
 * Computes the initial great-circle bearing from one geographic position to
 * another. The bearing is the direction to travel from the start point to
 * reach the end point along the shortest path on the Earth's surface.
 *
 * @param lat1 - Latitude of the start point in decimal degrees.
 * @param lon1 - Longitude of the start point in decimal degrees.
 * @param lat2 - Latitude of the end point in decimal degrees.
 * @param lon2 - Longitude of the end point in decimal degrees.
 * @returns Initial bearing in degrees true (0-360).
 */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const lat1Rad = angle.degreesToRadians(lat1);
  const lat2Rad = angle.degreesToRadians(lat2);
  const dLonRad = angle.degreesToRadians(lon2 - lon1);

  const y = Math.sin(dLonRad) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLonRad);

  return normalizeDeg(angle.radiansToDegrees(Math.atan2(y, x)));
}

/**
 * Combined result of {@link bearingAndDistance}.
 */
export interface BearingAndDistance {
  /** Initial great-circle bearing from the start point in degrees true (0-360). */
  bearingDeg: number;
  /** Great-circle distance between the two points in nautical miles. */
  distanceNm: number;
}

/**
 * Computes the initial great-circle bearing and distance from one geographic
 * position to another. Combines {@link bearing} and {@link distanceNm} into a
 * single call.
 *
 * @param lat1 - Latitude of the start point in decimal degrees.
 * @param lon1 - Longitude of the start point in decimal degrees.
 * @param lat2 - Latitude of the end point in decimal degrees.
 * @param lon2 - Longitude of the end point in decimal degrees.
 * @returns Object containing `bearingDeg` (0-360) and `distanceNm`.
 */
export function bearingAndDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): BearingAndDistance {
  return {
    bearingDeg: bearing(lat1, lon1, lat2, lon2),
    distanceNm: distanceNm(lat1, lon1, lat2, lon2),
  };
}

/**
 * Computes the great-circle midpoint between two geographic positions. The
 * midpoint is the point on the great-circle arc that is equidistant from both
 * endpoints.
 *
 * For antipodal inputs the midpoint is mathematically underdetermined (any
 * meridian is valid); the function still returns a finite, deterministic
 * result rather than throwing. Output longitude is normalized to the range
 * `[-180, 180]`; points on the antimeridian may be represented with either
 * sign.
 *
 * @param lat1 - Latitude of the first point in decimal degrees.
 * @param lon1 - Longitude of the first point in decimal degrees.
 * @param lat2 - Latitude of the second point in decimal degrees.
 * @param lon2 - Longitude of the second point in decimal degrees.
 * @returns Midpoint coordinates in decimal degrees.
 */
export function midpoint(lat1: number, lon1: number, lat2: number, lon2: number): Coordinates {
  const lat1Rad = angle.degreesToRadians(lat1);
  const lat2Rad = angle.degreesToRadians(lat2);
  const lon1Rad = angle.degreesToRadians(lon1);
  const dLonRad = angle.degreesToRadians(lon2 - lon1);

  const bx = Math.cos(lat2Rad) * Math.cos(dLonRad);
  const by = Math.cos(lat2Rad) * Math.sin(dLonRad);

  const midLatRad = Math.atan2(
    Math.sin(lat1Rad) + Math.sin(lat2Rad),
    Math.sqrt((Math.cos(lat1Rad) + bx) * (Math.cos(lat1Rad) + bx) + by * by),
  );
  const midLonRad = lon1Rad + Math.atan2(by, Math.cos(lat1Rad) + bx);

  return {
    lat: angle.radiansToDegrees(midLatRad),
    lon: ((angle.radiansToDegrees(midLonRad) + 540) % 360) - 180,
  };
}

/**
 * Computes the destination point reached by traveling a given distance along a
 * great-circle bearing from a starting position.
 *
 * The bearing is normalized via trigonometry, so values outside `[0, 360)`
 * (e.g. `-90` or `450`) behave as their wrapped equivalents. A negative
 * `travelDistanceNm` is treated as travel in the opposite direction, producing
 * the same result as the positive distance at `bearingDeg + 180`. Output
 * longitude is normalized to the range `[-180, 180]`; points on the
 * antimeridian may be represented with either sign.
 *
 * @param lat - Latitude of the start point in decimal degrees.
 * @param lon - Longitude of the start point in decimal degrees.
 * @param bearingDeg - Initial bearing in degrees true. Values outside [0, 360) are normalized.
 * @param travelDistanceNm - Distance to travel along the bearing in nautical miles. Negative values reverse direction.
 * @returns Destination coordinates in decimal degrees.
 */
export function destination(
  lat: number,
  lon: number,
  bearingDeg: number,
  travelDistanceNm: number,
): Coordinates {
  const latRad = angle.degreesToRadians(lat);
  const lonRad = angle.degreesToRadians(lon);
  const bearingRad = angle.degreesToRadians(bearingDeg);
  const angularDistance = travelDistanceNm / EARTH_RADIUS_NM;

  const destLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad),
  );
  const destLonRad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLatRad),
    );

  return {
    lat: angle.radiansToDegrees(destLatRad),
    lon: ((angle.radiansToDegrees(destLonRad) + 540) % 360) - 180,
  };
}
