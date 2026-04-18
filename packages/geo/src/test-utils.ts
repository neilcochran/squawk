/**
 * Returns true if the absolute difference between a and b is within delta.
 * Used across spec files for floating-point comparisons where exact equality
 * is not appropriate.
 *
 * @param a - First value to compare.
 * @param b - Second value to compare.
 * @param delta - Maximum allowed absolute difference (default: 0.001).
 * @returns True if |a - b| <= delta.
 */
export function close(a: number, b: number, delta = 0.001): boolean {
  return Math.abs(a - b) <= delta;
}
