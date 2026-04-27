import { describe, it, expect } from 'vitest';
import { bboxFromCoords } from './geometry.ts';

describe('bboxFromCoords', () => {
  it('returns undefined for an empty iterable', () => {
    expect(bboxFromCoords([])).toBeUndefined();
  });

  it('returns a degenerate bbox for a single coord', () => {
    expect(bboxFromCoords([[10, 20]])).toEqual({
      minLon: 10,
      maxLon: 10,
      minLat: 20,
      maxLat: 20,
    });
  });

  it('takes the min and max across multiple coords', () => {
    expect(
      bboxFromCoords([
        [10, 20],
        [30, 40],
        [-5, 25],
      ]),
    ).toEqual({ minLon: -5, maxLon: 30, minLat: 20, maxLat: 40 });
  });

  it('handles longitudes that cross zero without special-casing', () => {
    expect(
      bboxFromCoords([
        [-10, 0],
        [10, 0],
      ]),
    ).toEqual({ minLon: -10, maxLon: 10, minLat: 0, maxLat: 0 });
  });

  it('consumes a generator', () => {
    function* gen(): Generator<readonly [number, number]> {
      yield [1, 1];
      yield [2, 3];
    }
    expect(bboxFromCoords(gen())).toEqual({ minLon: 1, maxLon: 2, minLat: 1, maxLat: 3 });
  });
});
