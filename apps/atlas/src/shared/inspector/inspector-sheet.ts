/**
 * Fraction of the sheet's draggable range a pointer must cross before a
 * release commits to the opposite snap state. Below this, the drag
 * reverts to where it started. A third of the range keeps an accidental
 * nudge from toggling while still letting a deliberate half-swipe land.
 */
const SHEET_SNAP_THRESHOLD = 0.33;

/**
 * Inputs for {@link resolveSheetSnap}.
 */
export interface ResolveSheetSnapParams {
  /**
   * Current vertical drag offset in pixels, measured from the fully
   * expanded position (`0`) toward the fully minimized position
   * (`maxOffsetPx`).
   */
  offsetPx: number;
  /**
   * Total draggable range in pixels: the sheet height minus the visible
   * header peek. `0` when the sheet has no body to slide away.
   */
  maxOffsetPx: number;
  /**
   * Whether the drag began from the minimized state. Determines which
   * direction must cross the threshold to flip the snap.
   */
  startedMinimized: boolean;
}

/**
 * Decides which state a sheet drag should snap to on release. The drag
 * commits to the opposite state only when the pointer has crossed
 * {@link SHEET_SNAP_THRESHOLD} of the draggable range in the right
 * direction; otherwise it reverts to where it started. A degenerate
 * range (`maxOffsetPx <= 0`, e.g. a body shorter than the peek) keeps
 * the current state so the sheet never snaps to an unreachable position.
 *
 * @param params - The drag offset, draggable range, and starting state.
 * @returns `'minimized'` or `'expanded'` - the state to settle into.
 */
export function resolveSheetSnap(params: ResolveSheetSnapParams): 'minimized' | 'expanded' {
  const { offsetPx, maxOffsetPx, startedMinimized } = params;
  if (maxOffsetPx <= 0) {
    return startedMinimized ? 'minimized' : 'expanded';
  }
  // Measure travel in the direction that would flip the snap: downward
  // from an expanded start, upward from a minimized start. Each is its
  // own pixel ratio rather than one derived from the other via
  // `1 - fraction`, so both boundaries stay inclusive and symmetric - an
  // exact-threshold drag commits the same whether dragging up or down,
  // with no floating-point rounding artifact favoring one direction.
  if (startedMinimized) {
    const upwardTravel = Math.min(Math.max((maxOffsetPx - offsetPx) / maxOffsetPx, 0), 1);
    return upwardTravel >= SHEET_SNAP_THRESHOLD ? 'expanded' : 'minimized';
  }
  const downwardTravel = Math.min(Math.max(offsetPx / maxOffsetPx, 0), 1);
  return downwardTravel >= SHEET_SNAP_THRESHOLD ? 'minimized' : 'expanded';
}

/**
 * Inputs for {@link computeSheetOcclusionPx}.
 */
export interface ComputeSheetOcclusionParams {
  /**
   * Whether the inspector is currently rendered. `false` (idle, no
   * selection) yields zero occlusion so overlay map controls drop back to
   * their base offset.
   */
  active: boolean;
  /**
   * Live drag offset in pixels while a sheet drag is in progress, or
   * `undefined` when no drag is active. Measured downward from the fully
   * expanded position, matching {@link ResolveSheetSnapParams.offsetPx}.
   */
  dragOffsetPx: number | undefined;
  /**
   * Whether the sheet is committed to its minimized (peek-only) state.
   * Ignored while a drag is in progress.
   */
  minimized: boolean;
  /**
   * Measured full height of the sheet in pixels (its rendered
   * `offsetHeight`, capped by the `max-h-[60vh]` style).
   */
  sheetHeightPx: number;
  /**
   * Measured height of the always-visible peek region (grab handle +
   * header) in pixels.
   */
  peekHeightPx: number;
}

/**
 * Computes how many pixels the mobile bottom-sheet inspector occludes
 * upward from the bottom of the map, so overlay controls (zoom / tilt)
 * can lift to sit just above the sheet's live top edge. The value is the
 * visible sheet height measured up from the viewport bottom:
 *
 * - `0` when the inspector is not active.
 * - The full sheet height when expanded.
 * - The peek height when minimized.
 * - `sheetHeightPx - dragOffsetPx` while a drag is in progress, so the
 *   value tracks the finger 1:1.
 *
 * The result is clamped non-negative, and the minimized case is
 * additionally capped at the sheet height in case a peek measurement
 * briefly exceeds it during layout settling.
 *
 * @param params - Active flag, live drag offset, minimized flag, and the
 * measured sheet and peek heights.
 * @returns The occlusion height in pixels, never negative.
 */
export function computeSheetOcclusionPx(params: ComputeSheetOcclusionParams): number {
  const { active, dragOffsetPx, minimized, sheetHeightPx, peekHeightPx } = params;
  if (!active) {
    return 0;
  }
  if (dragOffsetPx !== undefined) {
    return Math.max(sheetHeightPx - dragOffsetPx, 0);
  }
  if (minimized) {
    return Math.max(Math.min(peekHeightPx, sheetHeightPx), 0);
  }
  return Math.max(sheetHeightPx, 0);
}
