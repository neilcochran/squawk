import type { Aircraft } from '@squawk/types';

/**
 * Whether `aircraft` matches `query` (case-insensitive substring match
 * against ICAO hex, callsign, or squawk). An empty or all-whitespace query
 * never matches, so an unsubmitted search box selects nothing.
 *
 * @param aircraft - The aircraft to test.
 * @param query - The search text.
 * @returns True if `query` is a substring of the aircraft's hex, callsign, or squawk.
 */
export function matchesSearch(aircraft: Aircraft, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') {
    return false;
  }
  return (
    aircraft.icaoHex.toLowerCase().includes(normalized) ||
    (aircraft.callsign?.toLowerCase().includes(normalized) ?? false) ||
    (aircraft.squawk?.toLowerCase().includes(normalized) ?? false)
  );
}

/**
 * Finds the next aircraft matching `query`, searching from just after
 * `currentIcaoHex` in `direction` and wrapping around the ends of `aircraft`.
 * Used both for the initial search submit (searching forward from whatever
 * row is currently selected) and for cycling to the next/previous match with
 * `[N]`/`[Shift+N]`.
 *
 * @param aircraft - The currently displayed aircraft, in display order.
 * @param query - The search text.
 * @param currentIcaoHex - The currently selected aircraft's ICAO hex, or undefined if none is selected.
 * @param direction - 1 to search forward (next match), -1 to search backward (previous match).
 * @returns The ICAO hex of the next match, or undefined if `query` matches nothing.
 */
export function findMatchIcaoHex(
  aircraft: readonly Aircraft[],
  query: string,
  currentIcaoHex: string | undefined,
  direction: 1 | -1,
): string | undefined {
  const matchIndices: number[] = [];
  aircraft.forEach((candidate, index) => {
    if (matchesSearch(candidate, query)) {
      matchIndices.push(index);
    }
  });
  const firstMatchIndex = matchIndices[0];
  const lastMatchIndex = matchIndices[matchIndices.length - 1];
  if (firstMatchIndex === undefined || lastMatchIndex === undefined) {
    return undefined;
  }

  const currentIndex =
    currentIcaoHex === undefined ? -1 : aircraft.findIndex((a) => a.icaoHex === currentIcaoHex);

  if (direction === 1) {
    const next = matchIndices.find((index) => index > currentIndex) ?? firstMatchIndex;
    return aircraft[next]?.icaoHex;
  }

  const reversedMatches = [...matchIndices].reverse();
  const previous = reversedMatches.find((index) => index < currentIndex) ?? lastMatchIndex;
  return aircraft[previous]?.icaoHex;
}
