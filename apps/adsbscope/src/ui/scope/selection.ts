import type { ScopeSnapshot, ScopeTarget } from '../../shared/protocol.js';

import { formatDataBlock } from './data-block.js';
import { isWithinExtent } from './extent.js';
import type { ScopeExtent } from './extent.js';
import { polarToScreen } from './projection.js';
import type { ScopeViewport, ScreenPoint } from './projection.js';

/** How close to an aircraft's position a click or tap must land to select it, in rem: generous enough for a fingertip. */
export const PICK_RADIUS_REM = 1.25;

/** Which way {@link stepSelection} moves through the aircraft. */
export type SelectionDirection = 'next' | 'previous';

/**
 * Finds the aircraft a click or tap on the scope was aimed at: the nearest
 * one within {@link PICK_RADIUS_REM} of the point. Only aircraft the view
 * style draws can be picked, so a click in the dark corners of a round scope
 * selects nothing.
 *
 * @param viewport - The current viewport.
 * @param snapshot - The most recent snapshot, or undefined before the first one arrives.
 * @param point - Where the click landed, in canvas CSS pixels.
 * @param extent - How far the view style's scope reaches.
 * @returns The ICAO hex of the aircraft picked, or undefined if the click hit none.
 */
export function pickTarget(
  viewport: ScopeViewport,
  snapshot: ScopeSnapshot | undefined,
  point: ScreenPoint,
  extent: ScopeExtent,
): string | undefined {
  let nearestHex: string | undefined;
  let nearestPx = PICK_RADIUS_REM * viewport.pxPerRem;
  for (const target of snapshot?.targets ?? []) {
    if (target.position === undefined || !isWithinExtent(viewport, target.position, extent)) {
      continue;
    }
    const at = polarToScreen(viewport, target.position);
    const distancePx = Math.hypot(at.xPx - point.xPx, at.yPx - point.yPx);
    if (distancePx <= nearestPx) {
      nearestHex = target.icaoHex;
      nearestPx = distancePx;
    }
  }
  return nearestHex;
}

/**
 * Finds the selected aircraft in a snapshot.
 *
 * @param snapshot - The most recent snapshot, or undefined before the first one arrives.
 * @param selectedIcaoHex - The ICAO hex of the selected aircraft, if there is one.
 * @returns The aircraft, or undefined if nothing is selected or the selected aircraft is no longer tracked.
 */
export function findSelectedTarget(
  snapshot: ScopeSnapshot | undefined,
  selectedIcaoHex: string | undefined,
): ScopeTarget | undefined {
  if (selectedIcaoHex === undefined) {
    return undefined;
  }
  return snapshot?.targets.find((target) => target.icaoHex === selectedIcaoHex);
}

/**
 * Moves the selection to the next or previous aircraft, for selecting without
 * a pointer. Aircraft are taken in order of identity - the order the lists
 * show them in - and the selection wraps round at either end. Every tracked
 * aircraft can be reached this way, including one with no position, which
 * cannot be clicked.
 *
 * @param snapshot - The most recent snapshot, or undefined before the first one arrives.
 * @param selectedIcaoHex - The ICAO hex of the selected aircraft, if there is one.
 * @param direction - Which way to move.
 * @returns The ICAO hex to select: the first or last aircraft if nothing was selected (or the selected aircraft has gone), and undefined only if nothing is tracked.
 */
export function stepSelection(
  snapshot: ScopeSnapshot | undefined,
  selectedIcaoHex: string | undefined,
  direction: SelectionDirection,
): string | undefined {
  const ordered = [...(snapshot?.targets ?? [])]
    .map((target) => ({ icaoHex: target.icaoHex, identity: formatDataBlock(target)[0] }))
    .sort((a, b) => a.identity.localeCompare(b.identity) || a.icaoHex.localeCompare(b.icaoHex));
  const step = direction === 'next' ? 1 : -1;
  const from = ordered.findIndex((entry) => entry.icaoHex === selectedIcaoHex);
  const start = direction === 'next' ? -1 : 0;
  const index = ((from === -1 ? start : from) + step + ordered.length) % ordered.length;
  return ordered[index]?.icaoHex;
}
