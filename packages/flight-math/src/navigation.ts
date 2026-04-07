/**
 * Navigation calculations: holding pattern entry, DME arc lead radial,
 * ETE/fuel planning, great-circle bearing, and 1-in-60 rule crosstrack
 * corrections.
 */

import type { HoldingPatternEntryType } from '@squawk/types';
import { angle, distance } from '@squawk/units';

/** Standard acceleration of gravity in ft/s^2. */
const G_FT_S2 = 32.174;

/** Knots to feet per second conversion factor. */
const KT_TO_FPS = 6076.11549 / 3600;

/** Feet per nautical mile. */
const FT_PER_NM = 6076.11549;

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
 * Determines the recommended holding pattern entry type (direct, teardrop, or
 * parallel) based on the aircraft's heading to the fix and the holding
 * pattern's inbound course.
 *
 * The three entry sectors are defined by the AIM (Section 5-3-8). For a
 * right-turn hold, the sectors are measured clockwise from the outbound
 * course: parallel (0-70 degrees), teardrop (70-180 degrees), and direct
 * (180-360 degrees). Left-turn holds mirror this geometry.
 *
 * @param inboundCourseDeg - Inbound course to the holding fix in degrees (0-360).
 * @param headingToFixDeg - Aircraft's current heading or bearing to the fix in degrees (0-360).
 * @param rightTurns - True for a right-turn hold (default), false for left-turn.
 * @returns The recommended entry type.
 */
export function holdingPatternEntry(
  inboundCourseDeg: number,
  headingToFixDeg: number,
  rightTurns: boolean = true,
): HoldingPatternEntryType {
  const outbound = normalizeDeg(inboundCourseDeg + 180);
  const theta = rightTurns
    ? normalizeDeg(headingToFixDeg - outbound)
    : normalizeDeg(outbound - headingToFixDeg);

  if (theta < 70) {
    return 'parallel';
  }
  if (theta < 180) {
    return 'teardrop';
  }
  return 'direct';
}

/**
 * Computes the lead angle in degrees for intercepting a DME arc from a radial.
 * The lead angle tells the pilot how many degrees of radial change before the
 * desired arc intercept point to begin the turn onto the arc.
 *
 * Uses the turn radius at the given TAS and bank angle to determine how far
 * ahead of the arc the turn should begin. Defaults to 25 degrees of bank if
 * not specified.
 *
 * @param arcRadiusNm - DME arc radius in nautical miles.
 * @param tasKt - True airspeed in knots.
 * @param bankAngleDeg - Bank angle for the turn in degrees (default 25).
 * @returns Lead angle in degrees of radial change.
 */
export function dmeArcLeadRadial(
  arcRadiusNm: number,
  tasKt: number,
  bankAngleDeg: number = 25,
): number {
  const vFps = tasKt * KT_TO_FPS;
  const bankRad = angle.degreesToRadians(bankAngleDeg);
  const turnRadiusFt = (vFps * vFps) / (G_FT_S2 * Math.tan(bankRad));
  const turnRadiusNm = turnRadiusFt / FT_PER_NM;
  return angle.radiansToDegrees(Math.asin(Math.min(turnRadiusNm / arcRadiusNm, 1)));
}

/**
 * Computes the initial great-circle bearing from one geographic position to
 * another. The bearing is the direction to travel from the start point to
 * reach the end point along the shortest path on the Earth's surface.
 *
 * This complements `distance.greatCircleDistanceNm()` in `@squawk/units`,
 * which provides the distance but not the bearing.
 *
 * @param lat1 - Latitude of the start point in decimal degrees.
 * @param lon1 - Longitude of the start point in decimal degrees.
 * @param lat2 - Latitude of the end point in decimal degrees.
 * @param lon2 - Longitude of the end point in decimal degrees.
 * @returns Initial bearing in degrees true (0-360).
 */
export function greatCircleBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
 * Computes the initial great-circle bearing and distance from one geographic
 * position to another. Combines {@link greatCircleBearing} and
 * `distance.greatCircleDistanceNm()` from `@squawk/units` into a single call.
 *
 * @param lat1 - Latitude of the start point in decimal degrees.
 * @param lon1 - Longitude of the start point in decimal degrees.
 * @param lat2 - Latitude of the end point in decimal degrees.
 * @param lon2 - Longitude of the end point in decimal degrees.
 * @returns Object with `bearingDeg` (0-360) and `distanceNm`.
 */
export function greatCircleBearingAndDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): { bearingDeg: number; distanceNm: number } {
  return {
    bearingDeg: greatCircleBearing(lat1, lon1, lat2, lon2),
    distanceNm: distance.greatCircleDistanceNm(lat1, lon1, lat2, lon2),
  };
}

/**
 * Computes the crosstrack correction angle using the 1-in-60 rule. Given an
 * off-course distance and the distance flown, returns the angle in degrees
 * needed to correct back to the desired track.
 *
 * The 1-in-60 rule approximation: 1 degree of track error produces roughly
 * 1 NM of displacement per 60 NM of distance flown. This is accurate for
 * small angles (under ~10 degrees).
 *
 * @param offCourseDistanceNm - Distance off the desired track in nautical miles.
 * @param distanceFlownNm - Distance already flown from the origin in nautical miles.
 * @returns Correction angle in degrees.
 */
export function correctionAngle(offCourseDistanceNm: number, distanceFlownNm: number): number {
  return 60 * (offCourseDistanceNm / distanceFlownNm);
}

/**
 * Computes the off-course distance using the 1-in-60 rule. Given a track error
 * angle and distance flown, returns the lateral displacement from the desired
 * track.
 *
 * @param trackErrorDeg - Track error angle in degrees.
 * @param distanceFlownNm - Distance flown from the origin in nautical miles.
 * @returns Off-course distance in nautical miles.
 */
export function offCourseDistance(trackErrorDeg: number, distanceFlownNm: number): number {
  return (trackErrorDeg / 60) * distanceFlownNm;
}
