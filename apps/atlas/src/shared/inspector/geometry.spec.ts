import { describe, it, expect } from 'vitest';
import { bboxFromCoords } from './geometry.ts';

describe('bboxFromCoords', () => {
  it('returns undefined for an empty iterable', () => {
    expect(bboxFromCoords([])).toBeUndefined();
  });

  it('returns a degenerate bbox for a single coord', () => {
    expect(bboxFromCoords([[10, 20]])).toEqual([10, 20, 10, 20]);
  });

  it('takes the min and max across multiple coords', () => {
    expect(
      bboxFromCoords([
        [10, 20],
        [30, 40],
        [-5, 25],
      ]),
    ).toEqual([-5, 20, 30, 40]);
  });

  it('handles longitudes that cross zero without special-casing', () => {
    expect(
      bboxFromCoords([
        [-10, 0],
        [10, 0],
      ]),
    ).toEqual([-10, 0, 10, 0]);
  });

  it('consumes a generator', () => {
    function* gen(): Generator<readonly [number, number]> {
      yield [1, 1];
      yield [2, 3];
    }
    expect(bboxFromCoords(gen())).toEqual([1, 1, 2, 3]);
  });
});
