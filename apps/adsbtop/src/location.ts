import { greatCircle } from '@squawk/geo';
import type { Aircraft, Coordinates } from '@squawk/types';

/**
 * Distance in nautical miles from a fixed observer `location` to `aircraft`'s
 * current position, for the Dist column.
 *
 * @param location - The configured receiver location (`--lat`/`--lon`).
 * @param aircraft - The aircraft to measure distance to.
 * @returns The great-circle distance in nautical miles, or undefined if the aircraft has no position yet.
 */
export function distanceToAircraftNm(
  location: Coordinates,
  aircraft: Aircraft,
): number | undefined {
  const position = aircraft.position;
  return position === undefined
    ? undefined
    : greatCircle.distanceNm(location.lat, location.lon, position.lat, position.lon);
}

/**
 * Initial great-circle bearing in degrees true from a fixed observer
 * `location` to `aircraft`'s current position, for the Brg column.
 *
 * @param location - The configured receiver location (`--lat`/`--lon`).
 * @param aircraft - The aircraft to measure bearing to.
 * @returns The bearing in degrees true (0-360), or undefined if the aircraft has no position yet.
 */
export function bearingToAircraftDeg(
  location: Coordinates,
  aircraft: Aircraft,
): number | undefined {
  const position = aircraft.position;
  return position === undefined
    ? undefined
    : greatCircle.bearing(location.lat, location.lon, position.lat, position.lon);
}
