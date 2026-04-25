import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closeRing, stripClosingDuplicate, type LonLat } from './close-ring.js';

describe('closeRing', () => {
  it('returns an empty array for an empty input', () => {
    assert.deepEqual(closeRing([]), []);
  });

  it('appends a copy of the first vertex when the ring is open', () => {
    const ring: LonLat[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const closed = closeRing(ring);
    assert.equal(closed.length, 5);
    assert.deepEqual(closed[closed.length - 1], [0, 0]);
    // Original input is not mutated.
    assert.equal(ring.length, 4);
  });

  it('returns a copy unchanged when first and last vertices match', () => {
    const ring: LonLat[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
    ];
    const closed = closeRing(ring);
    assert.equal(closed.length, 4);
    assert.deepEqual(closed, ring);
    assert.notEqual(closed, ring, 'returns a fresh array, not the same reference');
  });

  it('treats lat differing as needing a close even when lon matches', () => {
    const ring: LonLat[] = [
      [0, 0],
      [10, 0],
      [0, 5],
    ];
    const closed = closeRing(ring);
    assert.equal(closed.length, 4);
    assert.deepEqual(closed[closed.length - 1], [0, 0]);
  });
});

describe('stripClosingDuplicate', () => {
  it('returns an empty array for an empty input', () => {
    assert.deepEqual(stripClosingDuplicate([]), []);
  });

  it('returns a copy of a single-vertex input unchanged', () => {
    const ring: LonLat[] = [[1, 2]];
    const result = stripClosingDuplicate(ring);
    assert.deepEqual(result, ring);
  });

  it('drops the trailing vertex when first and last match', () => {
    const ring: LonLat[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
    ];
    const open = stripClosingDuplicate(ring);
    assert.equal(open.length, 3);
    assert.deepEqual(open, [
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
    assert.deepEqual(open, ring);
    assert.notEqual(open, ring, 'returns a fresh array, not the same reference');
  });
});
