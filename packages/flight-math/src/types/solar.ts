/**
 * Solar position type definitions.
 */

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
