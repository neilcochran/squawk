/**
 * E6B wind triangle calculations: forward wind triangle (heading and groundspeed
 * from TAS, course, and wind), headwind/crosswind component breakdown, and
 * reverse wind triangle (finding the wind from observed ground track and airspeed).
 */

import { angle } from '@squawk/units';

import type { WindComponents, WindTriangleResult, WindVector } from './types/wind.js';

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
 * Solves the forward wind triangle: given true airspeed, true course, wind
 * direction, and wind speed, computes the true heading, wind correction angle,
 * and groundspeed.
 *
 * The wind correction angle (WCA) is the crab angle the aircraft must hold into
 * the wind to maintain the desired ground track. A positive WCA means the aircraft
 * crabs to the right; negative means to the left.
 *
 * If the wind speed exceeds TAS (the wind is stronger than the aircraft can fly),
 * the aircraft cannot maintain the desired course. In this case the WCA is clamped
 * to the maximum correctable angle and the resulting ground track will not match
 * the requested true course.
 *
 * @param trueAirspeedKt - True airspeed in knots.
 * @param trueCourseDeg - Desired ground track (true course) in degrees (0-360).
 * @param windDirectionDeg - Direction the wind is blowing FROM in degrees true (0-360).
 * @param windSpeedKt - Wind speed in knots.
 * @returns The computed heading, wind correction angle, and groundspeed.
 */
export function solveWindTriangle(
  trueAirspeedKt: number,
  trueCourseDeg: number,
  windDirectionDeg: number,
  windSpeedKt: number,
): WindTriangleResult {
  const tcRad = angle.degreesToRadians(trueCourseDeg);
  const wdRad = angle.degreesToRadians(windDirectionDeg);

  // Wind correction angle via the law of sines on the wind triangle.
  // sin(WCA) = (windSpeed / TAS) * sin(windDirection - trueCourse)
  const sinWca = (windSpeedKt / trueAirspeedKt) * Math.sin(wdRad - tcRad);

  // Clamp to [-1, 1] to handle edge cases where wind exceeds TAS.
  const wca = Math.asin(Math.max(-1, Math.min(1, sinWca)));
  const wcaDeg = angle.radiansToDegrees(wca);

  const thDeg = normalizeDeg(trueCourseDeg + wcaDeg);
  const thRad = angle.degreesToRadians(thDeg);

  // Groundspeed from vector components: ground = air + wind.
  // Wind FROM direction means velocity is towards (WD + 180).
  const gsE = trueAirspeedKt * Math.sin(thRad) - windSpeedKt * Math.sin(wdRad);
  const gsN = trueAirspeedKt * Math.cos(thRad) - windSpeedKt * Math.cos(wdRad);
  const gs = Math.sqrt(gsE * gsE + gsN * gsN);

  return {
    trueHeadingDeg: thDeg,
    windCorrectionAngleDeg: wcaDeg,
    groundSpeedKt: gs,
  };
}

/**
 * Resolves wind into headwind and crosswind components relative to a heading
 * or runway orientation.
 *
 * Sign conventions:
 * - Headwind: positive = headwind (wind opposing motion), negative = tailwind.
 * - Crosswind: positive = wind from the right, negative = wind from the left.
 *
 * @param windDirectionDeg - Direction the wind is blowing FROM in degrees true (0-360).
 * @param windSpeedKt - Wind speed in knots.
 * @param headingDeg - Aircraft heading or runway heading in degrees (0-360).
 * @returns Headwind and crosswind components.
 */
export function headwindCrosswind(
  windDirectionDeg: number,
  windSpeedKt: number,
  headingDeg: number,
): WindComponents {
  const deltaRad = angle.degreesToRadians(windDirectionDeg - headingDeg);
  return {
    headwindKt: windSpeedKt * Math.cos(deltaRad),
    crosswindKt: windSpeedKt * Math.sin(deltaRad),
  };
}

/**
 * Derives wind direction and speed from the reverse wind triangle. Given the
 * observed groundspeed, true airspeed, true heading, and ground track, this
 * computes the wind that explains the difference between the air vector and
 * the ground vector.
 *
 * This is the inverse of {@link solveWindTriangle}: instead of finding the heading
 * needed for a given wind, it finds the wind from observed heading and track data.
 *
 * @param groundSpeedKt - Observed groundspeed in knots.
 * @param trueAirspeedKt - True airspeed in knots.
 * @param trueHeadingDeg - True heading in degrees (0-360).
 * @param trueTrackDeg - True ground track in degrees (0-360).
 * @returns Wind direction (FROM) and speed.
 */
export function findWind(
  groundSpeedKt: number,
  trueAirspeedKt: number,
  trueHeadingDeg: number,
  trueTrackDeg: number,
): WindVector {
  const thRad = angle.degreesToRadians(trueHeadingDeg);
  const tkRad = angle.degreesToRadians(trueTrackDeg);

  // Wind vector = ground vector - air vector.
  // Wind velocity is the direction the wind is GOING (towards), not from.
  const windToE = groundSpeedKt * Math.sin(tkRad) - trueAirspeedKt * Math.sin(thRad);
  const windToN = groundSpeedKt * Math.cos(tkRad) - trueAirspeedKt * Math.cos(thRad);

  const windSpeed = Math.sqrt(windToE * windToE + windToN * windToN);

  // Wind "to" direction, then flip 180 to get "from" direction.
  const windToDeg = angle.radiansToDegrees(Math.atan2(windToE, windToN));
  const windFromDeg = normalizeDeg(windToDeg + 180);

  return {
    directionDeg: windFromDeg,
    speedKt: windSpeed,
  };
}

/**
 * Returns the absolute crosswind component in knots for comparison against
 * a maximum demonstrated crosswind limit. This is a convenience wrapper around
 * {@link headwindCrosswind} that returns only the unsigned crosswind magnitude.
 *
 * @param windDirectionDeg - Direction the wind is blowing FROM in degrees true (0-360).
 * @param windSpeedKt - Wind speed in knots.
 * @param runwayHeadingDeg - Runway heading in degrees (0-360).
 * @returns Absolute crosswind component in knots.
 */
export function crosswindComponent(
  windDirectionDeg: number,
  windSpeedKt: number,
  runwayHeadingDeg: number,
): number {
  return Math.abs(headwindCrosswind(windDirectionDeg, windSpeedKt, runwayHeadingDeg).crosswindKt);
}
