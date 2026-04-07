/**
 * Types for aviation flight computer calculations used by `@squawk/flight-math`.
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

/**
 * Type of holding pattern entry procedure based on the angle between the
 * aircraft's heading to the fix and the holding pattern's inbound course.
 *
 * - `direct` - Fly directly to the fix and enter the hold (largest sector, ~180 degrees).
 * - `teardrop` - Fly to the fix, turn outbound on a 30-degree offset, then turn back inbound.
 * - `parallel` - Fly to the fix, turn to fly parallel to the inbound course outbound, then turn back.
 */
export type HoldingPatternEntryType = 'direct' | 'teardrop' | 'parallel';

/**
 * Sunrise, sunset, and civil twilight times for a given location and date.
 *
 * In polar regions, the sun may not rise or set on a given date. When an event
 * does not occur, the corresponding property is omitted. Consumers should check
 * for the presence of each property before using it.
 *
 * All times are in UTC.
 */
export interface SolarTimes {
  /** Sunrise time in UTC. Omitted if the sun does not rise (polar night). */
  sunrise?: Date;
  /** Sunset time in UTC. Omitted if the sun does not set (midnight sun). */
  sunset?: Date;
  /** Beginning of morning civil twilight in UTC. Omitted in extreme polar regions. */
  civilTwilightBegin?: Date;
  /** End of evening civil twilight in UTC. Omitted in extreme polar regions. */
  civilTwilightEnd?: Date;
}
