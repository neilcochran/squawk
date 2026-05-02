import { describe, it, expect } from 'vitest';
import { closeRing, stripClosingDuplicate, type LonLat } from './close-ring.js';

describe('closeRing', () => {
  it('returns an empty array for an empty input', () => {
    expect(closeRing([])).toEqual([]);
  });

  it('appends a copy of the first vertex when the ring is open', () => {
    const ring: LonLat[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const closed = closeRing(ring);
    expect(closed.length).toBe(5);
    expect(closed[closed.length - 1]).toEqual([0, 0]);
    // Original input is not mutated.
    expect(ring.length).toBe(4);
  });

  it('returns a copy unchanged when first and last vertices match', () => {
    const ring: LonLat[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
    ];
    const closed = closeRing(ring);
    expect(closed.length).toBe(4);
    expect(closed).toEqual(ring);
    expect(closed, 'returns a fresh array, not the same reference').not.toBe(ring);
  });

  it('treats lat differing as needing a close even when lon matches', () => {
    const ring: LonLat[] = [
      [0, 0],
      [10, 0],
      [0, 5],
    ];
    const closed = closeRing(ring);
    expect(closed.length).toBe(4);
    expect(closed[closed.length - 1]).toEqual([0, 0]);
  });
});

describe('stripClosingDuplicate', () => {
  it('returns an empty array for an empty input', () => {
    expect(stripClosingDuplicate([])).toEqual([]);
  });

  it('returns a copy of a single-vertex input unchanged', () => {
    const ring: LonLat[] = [[1, 2]];
    const result = stripClosingDuplicate(ring);
    expect(result).toEqual(ring);
  });

  it('drops the trailing vertex when first and last match', () => {
    const ring: LonLat[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
    ];
    const open = stripClosingDuplicate(ring);
    expect(open.length).toBe(3);
    expect(open).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
  });

  it('returns the ring unchanged when first and last differ', () => {
    const ring: LonLat[] = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    const open = stripClosingDuplicate(ring);
    expect(open).toEqual(ring);
    expect(open, 'returns a fresh array, not the same reference').not.toBe(ring);
  });
});
