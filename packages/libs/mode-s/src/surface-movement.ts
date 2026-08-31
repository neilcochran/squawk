/**
 * Movement-field decode table: lower bound of each bin, the ground speed
 * (kt) at that lower bound, and the per-step increment within the bin.
 * Per DO-260B SS A.2.4.2 - the 7-bit movement field packs finer resolution
 * at low speed (0.125 kt steps while taxiing) and coarser resolution at
 * high speed (5 kt steps), rather than a uniform linear scale.
 */
const BIN_LOWER_BOUND: readonly number[] = [2, 9, 13, 39, 94, 109, 124];
const KNOTS_AT_LOWER_BOUND: readonly number[] = [0.125, 1, 2, 15, 70, 100, 175];
const STEP_WITHIN_BIN: readonly number[] = [0.125, 0.25, 0.5, 1, 2, 5];

/**
 * Decodes the 7-bit movement field of an ADS-B surface position message
 * (BDS 0,6) to ground speed in knots.
 *
 * @param movementField - The raw 7-bit movement field, 0-127.
 * @returns Ground speed in knots, or undefined if the field reports no information (0) or is out of the defined range (>124).
 */
export function decodeSurfaceMovement(movementField: number): number | undefined {
  if (movementField === 0 || movementField > 124) {
    return undefined;
  }
  if (movementField === 1) {
    return 0;
  }
  if (movementField === 124) {
    return 175;
  }
  const binIndex = BIN_LOWER_BOUND.findIndex((lowerBound) => lowerBound > movementField);
  const previousBoundIndex = binIndex - 1;
  const lowerBound = BIN_LOWER_BOUND[previousBoundIndex];
  const knotsAtLowerBound = KNOTS_AT_LOWER_BOUND[previousBoundIndex];
  const step = STEP_WITHIN_BIN[previousBoundIndex];
  if (lowerBound === undefined || knotsAtLowerBound === undefined || step === undefined) {
    return undefined;
  }
  return knotsAtLowerBound + (movementField - lowerBound) * step;
}
