import type { PolarPoint } from '../../shared/protocol.js';

import type { ScopeViewport } from './projection.js';

/**
 * How far a view style's scope reaches. `canvas` fills the whole canvas, as a
 * modern scope's rectangular display does. `rangeCircle` stops at the circle
 * of the selected range, as everything did on a round tube, whose face ended
 * there.
 */
export type ScopeExtent = 'canvas' | 'rangeCircle';

/**
 * Decides whether a position lies within a scope's extent. The canvas extent
 * has no limit of its own - what is off the canvas is simply not seen - so
 * only the range circle ever rules a position out.
 *
 * @param viewport - The current viewport.
 * @param position - The position, relative to the receiver.
 * @param extent - How far the scope reaches.
 * @returns True if something at the position belongs on the scope.
 */
export function isWithinExtent(
  viewport: ScopeViewport,
  position: PolarPoint,
  extent: ScopeExtent,
): boolean {
  return extent === 'canvas' || position.rangeNm * viewport.pxPerNm <= viewport.radiusPx;
}
