import type { MatchRange } from '@squawk/search';

/**
 * A contiguous run of result text tagged with whether the fuzzy matcher
 * scored it. The results dropdown renders matched segments emphasized and
 * unmatched segments plain, reconstructing the full string in order.
 */
export interface HighlightSegment {
  /** The substring for this run. Never empty. */
  text: string;
  /** Whether this run falls inside a {@link MatchRange}. */
  matched: boolean;
}

/**
 * Splits `text` into ordered matched / unmatched segments from a set of
 * {@link MatchRange}s (half-open `[start, end)` character intervals).
 *
 * Ranges are clamped to the string bounds, sorted, and merged so overlapping
 * or adjacent ranges collapse into a single matched run. Empty segments are
 * never emitted, so concatenating every segment's `text` reproduces the input
 * exactly. A blank input yields an empty array.
 *
 * @param text - The full field text the ranges index into.
 * @param ranges - Matched character ranges, in any order.
 * @returns Ordered segments covering the whole string, matched runs flagged.
 */
export function splitByMatchRanges(
  text: string,
  ranges: readonly MatchRange[],
): HighlightSegment[] {
  if (text.length === 0) {
    return [];
  }

  // Clamp to bounds and drop empties, then sort so the merge walk is linear.
  const normalized = ranges
    .map((range) => ({
      start: Math.max(0, Math.min(range.start, text.length)),
      end: Math.max(0, Math.min(range.end, text.length)),
    }))
    .filter((range) => range.start < range.end)
    .sort((a, b) => a.start - b.start);

  // Merge overlapping or directly adjacent ranges so a boundary between two
  // ranges does not split one matched run into two segments.
  const merged: { start: number; end: number }[] = [];
  for (const range of normalized) {
    const last = merged[merged.length - 1];
    if (last !== undefined && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ start: range.start, end: range.end });
    }
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), matched: false });
    }
    segments.push({ text: text.slice(range.start, range.end), matched: true });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false });
  }
  return segments;
}
