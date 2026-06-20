import { describe, it, expect } from 'vitest';

import type { MatchRange } from '@squawk/search';

import { splitByMatchRanges } from './search-highlight.ts';

/**
 * Rebuilds the original string from a segment list. Every test asserts this
 * equals the input, since the split must be lossless and in order.
 */
function joinSegments(segments: ReturnType<typeof splitByMatchRanges>): string {
  return segments.map((segment) => segment.text).join('');
}

describe('splitByMatchRanges', () => {
  it('returns an empty array for blank text', () => {
    expect(splitByMatchRanges('', [{ start: 0, end: 0 }])).toEqual([]);
  });

  it('returns one unmatched segment when there are no ranges', () => {
    expect(splitByMatchRanges('BOSTON', [])).toEqual([{ text: 'BOSTON', matched: false }]);
  });

  it('splits a single interior range into unmatched / matched / unmatched', () => {
    const segments = splitByMatchRanges('BOSTON', [{ start: 1, end: 3 }]);
    expect(segments).toEqual([
      { text: 'B', matched: false },
      { text: 'OS', matched: true },
      { text: 'TON', matched: false },
    ]);
    expect(joinSegments(segments)).toBe('BOSTON');
  });

  it('omits the leading unmatched segment when a range starts at 0', () => {
    const segments = splitByMatchRanges('BOSTON', [{ start: 0, end: 3 }]);
    expect(segments).toEqual([
      { text: 'BOS', matched: true },
      { text: 'TON', matched: false },
    ]);
  });

  it('omits the trailing unmatched segment when a range ends at the string end', () => {
    const segments = splitByMatchRanges('BOSTON', [{ start: 3, end: 6 }]);
    expect(segments).toEqual([
      { text: 'BOS', matched: false },
      { text: 'TON', matched: true },
    ]);
  });

  it('returns a single matched segment when the range covers the whole string', () => {
    expect(splitByMatchRanges('BOS', [{ start: 0, end: 3 }])).toEqual([
      { text: 'BOS', matched: true },
    ]);
  });

  it('sorts out-of-order ranges before walking them', () => {
    const ranges: MatchRange[] = [
      { start: 4, end: 5 },
      { start: 0, end: 1 },
    ];
    const segments = splitByMatchRanges('ABCDE', ranges);
    expect(segments).toEqual([
      { text: 'A', matched: true },
      { text: 'BCD', matched: false },
      { text: 'E', matched: true },
    ]);
  });

  it('merges overlapping ranges into one matched run', () => {
    const segments = splitByMatchRanges('ABCDEF', [
      { start: 1, end: 4 },
      { start: 2, end: 5 },
    ]);
    expect(segments).toEqual([
      { text: 'A', matched: false },
      { text: 'BCDE', matched: true },
      { text: 'F', matched: false },
    ]);
  });

  it('merges directly adjacent ranges so a shared boundary does not split the run', () => {
    const segments = splitByMatchRanges('ABCDEF', [
      { start: 1, end: 3 },
      { start: 3, end: 5 },
    ]);
    expect(segments).toEqual([
      { text: 'A', matched: false },
      { text: 'BCDE', matched: true },
      { text: 'F', matched: false },
    ]);
  });

  it('clamps ranges that run past the string bounds', () => {
    const segments = splitByMatchRanges('ABC', [{ start: -5, end: 99 }]);
    expect(segments).toEqual([{ text: 'ABC', matched: true }]);
  });

  it('drops empty and inverted ranges', () => {
    const segments = splitByMatchRanges('ABC', [
      { start: 1, end: 1 },
      { start: 2, end: 0 },
    ]);
    expect(segments).toEqual([{ text: 'ABC', matched: false }]);
  });

  it('reproduces the input when concatenating segments across mixed ranges', () => {
    const text = 'KBOS BOSTON LOGAN';
    const segments = splitByMatchRanges(text, [
      { start: 5, end: 11 },
      { start: 0, end: 1 },
    ]);
    expect(joinSegments(segments)).toBe(text);
  });
});
