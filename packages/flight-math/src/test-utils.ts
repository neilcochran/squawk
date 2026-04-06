/**
 * Returns true if two numbers are within the given delta of each other.
 * Used for floating-point comparisons in tests.
 *
 * @param a - First value.
 * @param b - Second value.
 * @param delta - Maximum allowed difference (default 0.001).
 * @returns True if |a - b| <= delta.
 */
export function close(a: number, b: number, delta = 0.001): boolean {
  return Math.abs(a - b) <= delta;
}
