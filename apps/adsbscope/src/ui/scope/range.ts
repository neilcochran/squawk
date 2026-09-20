/** Which way to step the scope range: `'in'` to a smaller range, `'out'` to a larger one. */
export type RangeDirection = 'in' | 'out';

/** The scope ranges, in nautical miles, that the range keys step through. */
export const RANGE_STEPS_NM: readonly number[] = [5, 10, 20, 40, 60, 80, 100, 150, 200, 250];

const RING_SPACINGS_NM: readonly number[] = [1, 2, 5, 10, 20, 25, 50, 100];
const MAX_RING_COUNT = 6;

/**
 * Picks the spacing between range rings for a scope range: the finest
 * round-number spacing that draws no more than six rings, so the scope stays
 * readable at any range.
 *
 * @param rangeNm - Nautical miles from the center to the edge of the scope.
 * @returns The ring spacing in nautical miles.
 */
export function ringSpacingNm(rangeNm: number): number {
  for (const spacing of RING_SPACINGS_NM) {
    if (rangeNm / spacing <= MAX_RING_COUNT) {
      return spacing;
    }
  }
  return rangeNm / MAX_RING_COUNT;
}

/**
 * Lists the radii of the range rings to draw, innermost first, up to and
 * including the scope range when it falls on a ring.
 *
 * @param rangeNm - Nautical miles from the center to the edge of the scope.
 * @returns Ring radii in nautical miles.
 */
export function ringRadiiNm(rangeNm: number): number[] {
  const spacing = ringSpacingNm(rangeNm);
  const radii: number[] = [];
  for (let radius = spacing; radius <= rangeNm + 1e-9; radius += spacing) {
    radii.push(radius);
  }
  return radii;
}

/**
 * Whether the scope range can still be stepped in a direction, i.e. whether
 * {@link stepRange} would change it. Used to disable a zoom control at the
 * end of its travel.
 *
 * @param currentNm - The current scope range in nautical miles.
 * @param direction - The direction to step.
 * @returns True if a step in that direction changes the range.
 */
export function canStepRange(currentNm: number, direction: RangeDirection): boolean {
  return stepRange(currentNm, direction) !== currentNm;
}

/**
 * Steps the scope range in or out through {@link RANGE_STEPS_NM}. A current
 * range that is not itself a step (e.g. one set with `--range`) moves to the
 * nearest step in the requested direction. Stepping past either end stays at
 * that end.
 *
 * @param currentNm - The current scope range in nautical miles.
 * @param direction - `'in'` for a smaller range, `'out'` for a larger one.
 * @returns The new scope range in nautical miles.
 */
export function stepRange(currentNm: number, direction: RangeDirection): number {
  if (direction === 'out') {
    return RANGE_STEPS_NM.find((step) => step > currentNm) ?? currentNm;
  }
  return RANGE_STEPS_NM.findLast((step) => step < currentNm) ?? currentNm;
}
