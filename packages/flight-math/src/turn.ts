/**
 * Turn dynamics calculations: standard rate turn bank angle, turn radius,
 * time to complete a turn, and load factor from bank angle.
 */

import { angle } from '@squawk/units';

/** Standard acceleration of gravity in ft/s^2. */
const G_FT_S2 = 32.174;

/** Knots to feet per second conversion factor. */
const KT_TO_FPS = 6076.11549 / 3600;

/** Standard rate turn: 3 degrees per second. */
const STANDARD_RATE_DEG_PER_SEC = 3;

/**
 * Computes the bank angle required for a standard rate turn (3 degrees per
 * second) at a given true airspeed.
 *
 * The standard rate turn is defined as a 360-degree turn in 2 minutes. At
 * higher airspeeds, a steeper bank angle is needed to maintain the same turn
 * rate. The formula is derived from the balance of centripetal force and the
 * horizontal component of lift in a coordinated turn.
 *
 * @param trueAirspeedKt - True airspeed in knots.
 * @returns Bank angle in degrees required for a 3 deg/sec standard rate turn.
 */
export function standardRateBankAngle(trueAirspeedKt: number): number {
  const vFps = trueAirspeedKt * KT_TO_FPS;
  const turnRateRadPerSec = angle.degreesToRadians(STANDARD_RATE_DEG_PER_SEC);
  return angle.radiansToDegrees(Math.atan((vFps * turnRateRadPerSec) / G_FT_S2));
}

/**
 * Computes the turn radius for a given true airspeed and bank angle.
 *
 * @param trueAirspeedKt - True airspeed in knots.
 * @param bankAngleDeg - Bank angle in degrees.
 * @returns Turn radius in nautical miles.
 */
export function turnRadius(trueAirspeedKt: number, bankAngleDeg: number): number {
  const vFps = trueAirspeedKt * KT_TO_FPS;
  const bankRad = angle.degreesToRadians(bankAngleDeg);
  const radiusFt = (vFps * vFps) / (G_FT_S2 * Math.tan(bankRad));
  return radiusFt / 6076.11549;
}

/**
 * Computes the turn radius for a standard rate turn (3 degrees per second)
 * at a given true airspeed.
 *
 * @param trueAirspeedKt - True airspeed in knots.
 * @returns Turn radius in nautical miles.
 */
export function standardRateTurnRadius(trueAirspeedKt: number): number {
  return turnRadius(trueAirspeedKt, standardRateBankAngle(trueAirspeedKt));
}

/**
 * Computes the time to complete a turn of a given number of degrees at a
 * given turn rate.
 *
 * @param turnDeg - Degrees of turn (e.g. 90 for a quarter turn, 360 for a full circle).
 * @param turnRateDegPerSec - Turn rate in degrees per second (default 3 for standard rate).
 * @returns Time to complete the turn in seconds.
 */
export function timeToTurn(
  turnDeg: number,
  turnRateDegPerSec: number = STANDARD_RATE_DEG_PER_SEC,
): number {
  return Math.abs(turnDeg) / turnRateDegPerSec;
}

/**
 * Computes the load factor (g-force) in a coordinated level turn at a given
 * bank angle. Load factor increases with bank angle because the vertical
 * component of lift must still support the aircraft's weight while the
 * horizontal component provides centripetal force.
 *
 * At 0 degrees bank, load factor is 1g (straight and level).
 * At 60 degrees, it is 2g. At 75 degrees, approximately 3.86g.
 *
 * @param bankAngleDeg - Bank angle in degrees.
 * @returns Load factor in g (dimensionless).
 */
export function loadFactor(bankAngleDeg: number): number {
  return 1 / Math.cos(angle.degreesToRadians(bankAngleDeg));
}
