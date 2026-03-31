import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pointInPolygon } from './point-in-polygon.js';

/** Simple square polygon: corners at (0,0), (10,0), (10,10), (0,10). */
const square: number[][] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
];

/** L-shaped concave polygon. */
const lShape: number[][] = [
  [0, 0],
  [10, 0],
  [10, 5],
  [5, 5],
  [5, 10],
  [0, 10],
  [0, 0],
];

describe('pointInPolygon', () => {
  describe('simple square', () => {
    it('returns true for a point inside', () => {
      assert.equal(pointInPolygon(5, 5, square), true);
    });

    it('returns true for a point near the center', () => {
      assert.equal(pointInPolygon(1, 1, square), true);
    });

    it('returns false for a point outside (east)', () => {
      assert.equal(pointInPolygon(15, 5, square), false);
    });

    it('returns false for a point outside (north)', () => {
      assert.equal(pointInPolygon(5, 15, square), false);
    });

    it('returns false for a point outside (negative)', () => {
      assert.equal(pointInPolygon(-1, -1, square), false);
    });
  });

  describe('concave L-shape', () => {
    it('returns true for a point in the lower portion', () => {
      assert.equal(pointInPolygon(7, 2, lShape), true);
    });

    it('returns true for a point in the upper-left arm', () => {
      assert.equal(pointInPolygon(2, 8, lShape), true);
    });

    it('returns false for a point in the concave notch', () => {
      assert.equal(pointInPolygon(7, 7, lShape), false);
    });

    it('returns false for a point fully outside', () => {
      assert.equal(pointInPolygon(12, 12, lShape), false);
    });
  });

  describe('real-world coordinates', () => {
    /** Rough polygon around LAX airport. */
    const laxArea: number[][] = [
      [-118.42, 33.93],
      [-118.42, 33.96],
      [-118.38, 33.96],
      [-118.38, 33.93],
      [-118.42, 33.93],
    ];

    it('returns true for a point inside LAX area (negative lon, positive lat)', () => {
      assert.equal(pointInPolygon(-118.4, 33.945, laxArea), true);
    });

    it('returns false for a point outside LAX area', () => {
      assert.equal(pointInPolygon(-118.5, 33.945, laxArea), false);
    });
  });

  describe('edge cases', () => {
    it('returns false for a degenerate polygon (< 4 points)', () => {
      const triangle: number[][] = [
        [0, 0],
        [10, 0],
        [0, 0],
      ];
      assert.equal(pointInPolygon(5, 0, triangle), false);
    });

    it('returns false for an empty ring', () => {
      assert.equal(pointInPolygon(0, 0, []), false);
    });
  });
});
