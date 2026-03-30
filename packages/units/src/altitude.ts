/**
 * Typed unit string literals for altitude values to prevent unit confusion at the call site.
 */
export type AltitudeUnit = 'ft' | 'm';

/** Exact conversion: 1 foot = 0.3048 metres. */
const FT_TO_M = 0.3048;

/**
 * Converts an altitude in feet to metres.
 * @param feet - Altitude in feet.
 * @returns Altitude in metres.
 */
export function feetToMeters(feet: number): number {
  return feet * FT_TO_M;
}

/**
 * Converts an altitude in metres to feet.
 * @param meters - Altitude in metres.
 * @returns Altitude in feet.
 */
export function metersToFeet(meters: number): number {
  return meters / FT_TO_M;
}
