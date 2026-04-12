/**
 * Wind-related type definitions for E6B wind triangle calculations.
 */

/**
 * Result of the E6B wind triangle computation: the true heading, wind correction
 * angle, and groundspeed derived from a given true airspeed, true course, and wind.
 */
export interface WindTriangleResult {
  /** True heading in degrees (0-360). */
  trueHeadingDeg: number;
  /** Wind correction angle in degrees. Positive means crab right, negative means crab left. */
  windCorrectionAngleDeg: number;
  /** Groundspeed in knots. */
  groundspeedKt: number;
}

/**
 * Headwind and crosswind components resolved from a wind vector relative to a
 * heading or runway orientation.
 */
export interface WindComponents {
  /** Headwind component in knots. Positive is headwind, negative is tailwind. */
  headwindKt: number;
  /** Crosswind component in knots. Positive is from the right, negative is from the left. */
  crosswindKt: number;
}

/**
 * Wind direction and speed, typically derived from the reverse wind triangle
 * (given groundspeed, TAS, heading, and track).
 */
export interface WindVector {
  /** Wind direction in degrees true (the direction FROM which the wind blows, 0-360). */
  directionDeg: number;
  /** Wind speed in knots. */
  speedKt: number;
}
