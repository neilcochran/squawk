/**
 * Typed unit string literals for angle values to prevent unit confusion at the call site.
 */
export type AngleUnit = 'deg' | 'rad';

/**
 * Converts an angle in degrees to radians.
 * @param degrees - Angle in degrees.
 * @returns Angle in radians.
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Converts an angle in radians to degrees.
 * @param radians - Angle in radians.
 * @returns Angle in degrees.
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}
