import type { Aircraft } from '@squawk/types';

/**
 * Finds the index of the aircraft currently identified by `selectedIcaoHex`
 * within `aircraft`.
 *
 * @param aircraft - The currently displayed aircraft, in display order.
 * @param selectedIcaoHex - The selected aircraft's ICAO hex, or undefined if none is selected.
 * @returns The index of the selected aircraft, or -1 if none is selected or it is no longer present.
 */
export function findSelectedIndex(
  aircraft: readonly Aircraft[],
  selectedIcaoHex: string | undefined,
): number {
  if (selectedIcaoHex === undefined) {
    return -1;
  }
  return aircraft.findIndex((candidate) => candidate.icaoHex === selectedIcaoHex);
}

/**
 * Computes the ICAO hex to select after moving the cursor by `delta` rows
 * from the current selection. Clamped at the first/last row rather than
 * wrapping, matching `htop`'s arrow-key behavior. If the current selection
 * is unset or no longer present in `aircraft` (e.g. the aircraft was lost),
 * resets to the first row regardless of `delta` - simpler and more
 * predictable than trying to reconstruct "where it would have moved to".
 *
 * @param aircraft - The currently displayed aircraft, in display order.
 * @param selectedIcaoHex - The currently selected aircraft's ICAO hex, or undefined if none is selected.
 * @param delta - Rows to move: -1 for up, 1 for down.
 * @returns The ICAO hex to select next, or undefined if `aircraft` is empty.
 */
export function moveSelection(
  aircraft: readonly Aircraft[],
  selectedIcaoHex: string | undefined,
  delta: -1 | 1,
): string | undefined {
  if (aircraft.length === 0) {
    return undefined;
  }
  const currentIndex = findSelectedIndex(aircraft, selectedIcaoHex);
  if (currentIndex === -1) {
    return aircraft[0]?.icaoHex;
  }
  const nextIndex = Math.min(Math.max(currentIndex + delta, 0), aircraft.length - 1);
  return aircraft[nextIndex]?.icaoHex;
}
