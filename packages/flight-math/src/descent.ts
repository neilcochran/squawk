/**
 * Descent and climb planning calculations: top-of-descent point, required
 * vertical rates, gradient conversions, and visual descent point.
 */

import { angle } from '@squawk/units';

/** Feet per nautical mile (6076.11549 ft/nm). */
const FT_PER_NM = 6076.11549;

/** Feet-per-minute to nautical-miles-per-minute conversion at 1 knot groundspeed. */
const GS_FPM_FACTOR = FT_PER_NM / 60;

/**
 * Computes the distance from the target at which to begin a descent, given a
 * desired descent angle (flight path angle).
 *
 * A standard 3-degree glidepath is common for ILS and RNAV approaches.
 * The result is the horizontal distance in nautical miles from the target
 * point at which the descent should begin.
 *
 * @param currentAltFt - Current altitude in feet MSL.
 * @param targetAltFt - Target altitude in feet MSL.
 * @param descentAngleDeg - Desired descent angle in degrees (positive value).
 * @returns Distance from the target to begin descent, in nautical miles.
 */
export function topOfDescent(
  currentAltFt: number,
  targetAltFt: number,
  descentAngleDeg: number,
): number {
  const altToLose = currentAltFt - targetAltFt;
  const angleRad = angle.degreesToRadians(descentAngleDeg);
  return altToLose / (Math.tan(angleRad) * FT_PER_NM);
}

/**
 * Computes the distance from the target at which to begin a descent, given a
 * desired descent rate in feet per minute and a groundspeed.
 *
 * @param currentAltFt - Current altitude in feet MSL.
 * @param targetAltFt - Target altitude in feet MSL.
 * @param descentRateFpm - Desired descent rate in feet per minute (positive value).
 * @param groundspeedKt - Groundspeed in knots.
 * @returns Distance from the target to begin descent, in nautical miles.
 */
export function topOfDescentFromRate(
  currentAltFt: number,
  targetAltFt: number,
  descentRateFpm: number,
  groundspeedKt: number,
): number {
  const altToLose = currentAltFt - targetAltFt;
  const timeMin = altToLose / descentRateFpm;
  return groundspeedKt * (timeMin / 60);
}

/**
 * Computes the descent rate required to lose a given amount of altitude over a
 * given distance at a given groundspeed.
 *
 * @param distanceNm - Distance to the target point in nautical miles.
 * @param currentAltFt - Current altitude in feet MSL.
 * @param targetAltFt - Target altitude in feet MSL.
 * @param groundspeedKt - Groundspeed in knots.
 * @returns Required descent rate in feet per minute (positive value).
 */
export function requiredDescentRate(
  distanceNm: number,
  currentAltFt: number,
  targetAltFt: number,
  groundspeedKt: number,
): number {
  const altToLose = currentAltFt - targetAltFt;
  const timeMin = (distanceNm / groundspeedKt) * 60;
  return altToLose / timeMin;
}

/**
 * Computes the climb rate required to gain a given amount of altitude over a
 * given distance at a given groundspeed.
 *
 * @param distanceNm - Distance available for climbing in nautical miles.
 * @param currentAltFt - Current altitude in feet MSL.
 * @param targetAltFt - Target altitude in feet MSL.
 * @param groundspeedKt - Groundspeed in knots.
 * @returns Required climb rate in feet per minute (positive value).
 */
export function requiredClimbRate(
  distanceNm: number,
  currentAltFt: number,
  targetAltFt: number,
  groundspeedKt: number,
): number {
  const altToGain = targetAltFt - currentAltFt;
  const timeMin = (distanceNm / groundspeedKt) * 60;
  return altToGain / timeMin;
}

/**
 * Converts a vertical speed (feet per minute) to a flight path gradient angle
 * in degrees at a given groundspeed.
 *
 * @param verticalSpeedFpm - Vertical speed in feet per minute.
 * @param groundspeedKt - Groundspeed in knots.
 * @returns Flight path angle in degrees.
 */
export function verticalSpeedToGradient(verticalSpeedFpm: number, groundspeedKt: number): number {
  const horizontalFpm = groundspeedKt * GS_FPM_FACTOR;
  return angle.radiansToDegrees(Math.atan(verticalSpeedFpm / horizontalFpm));
}

/**
 * Converts a flight path gradient angle in degrees to a vertical speed (feet
 * per minute) at a given groundspeed.
 *
 * @param gradientDeg - Flight path angle in degrees.
 * @param groundspeedKt - Groundspeed in knots.
 * @returns Vertical speed in feet per minute.
 */
export function gradientToVerticalSpeed(gradientDeg: number, groundspeedKt: number): number {
  const horizontalFpm = groundspeedKt * GS_FPM_FACTOR;
  return Math.tan(angle.degreesToRadians(gradientDeg)) * horizontalFpm;
}

/**
 * Computes the Visual Descent Point (VDP) distance from the runway threshold.
 * The VDP is the point on a non-precision approach at which a normal descent
 * from the MDA to the runway threshold should begin.
 *
 * @param glidepathAngleDeg - Desired glidepath angle in degrees (typically 3.0).
 * @param thresholdCrossingHeightFt - Height above the threshold at the VDP start (MDA - TDZE, or TCH).
 * @returns Distance from the threshold in nautical miles.
 */
export function visualDescentPoint(
  glidepathAngleDeg: number,
  thresholdCrossingHeightFt: number,
): number {
  const angleRad = angle.degreesToRadians(glidepathAngleDeg);
  return thresholdCrossingHeightFt / (Math.tan(angleRad) * FT_PER_NM);
}
