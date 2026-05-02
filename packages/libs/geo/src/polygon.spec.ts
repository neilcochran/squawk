import { describe, it, expect } from 'vitest';
import { pointInPolygon, boundingBox, pointInBoundingBox } from './polygon.js';

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
      expect(pointInPolygon(5, 5, square)).toBe(true);
    });

    it('returns true for a point near the corner', () => {
      expect(pointInPolygon(1, 1, square)).toBe(true);
    });

    it('returns false for a point outside (east)', () => {
      expect(pointInPolygon(15, 5, square)).toBe(false);
    });

    it('returns false for a point outside (north)', () => {
      expect(pointInPolygon(5, 15, square)).toBe(false);
    });

    it('returns false for a point outside (negative)', () => {
      expect(pointInPolygon(-1, -1, square)).toBe(false);
    });
  });

  describe('concave L-shape', () => {
    it('returns true for a point in the lower portion', () => {
      expect(pointInPolygon(7, 2, lShape)).toBe(true);
    });

    it('returns true for a point in the upper-left arm', () => {
      expect(pointInPolygon(2, 8, lShape)).toBe(true);
    });

    it('returns false for a point in the concave notch', () => {
      expect(pointInPolygon(7, 7, lShape)).toBe(false);
    });

    it('returns false for a point fully outside', () => {
      expect(pointInPolygon(12, 12, lShape)).toBe(false);
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
      expect(pointInPolygon(-118.4, 33.945, laxArea)).toBe(true);
    });

    it('returns false for a point outside LAX area', () => {
      expect(pointInPolygon(-118.5, 33.945, laxArea)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for a degenerate polygon (< 4 points)', () => {
      const triangle: number[][] = [
        [0, 0],
        [10, 0],
        [0, 0],
      ];
      expect(pointInPolygon(5, 0, triangle)).toBe(false);
    });

    it('returns false for an empty ring', () => {
      expect(pointInPolygon(0, 0, [])).toBe(false);
    });
  });
});

describe('boundingBox', () => {
  it('computes the bbox of a simple square', () => {
    const box = boundingBox(square);
    expect(box).toEqual({ minLon: 0, maxLon: 10, minLat: 0, maxLat: 10 });
  });

  it('computes the bbox of a concave L-shape', () => {
    const box = boundingBox(lShape);
    expect(box).toEqual({ minLon: 0, maxLon: 10, minLat: 0, maxLat: 10 });
  });

  it('handles real-world negative longitudes', () => {
    const laxArea: number[][] = [
      [-118.42, 33.93],
      [-118.42, 33.96],
      [-118.38, 33.96],
      [-118.38, 33.93],
      [-118.42, 33.93],
    ];
    const box = boundingBox(laxArea);
    expect(box).toEqual({ minLon: -118.42, maxLon: -118.38, minLat: 33.93, maxLat: 33.96 });
  });

  it('returns a degenerate empty box for an empty ring', () => {
    const box = boundingBox([]);
    expect(box.minLon).toBe(Infinity);
    expect(box.maxLon).toBe(-Infinity);
    expect(box.minLat).toBe(Infinity);
    expect(box.maxLat).toBe(-Infinity);
  });

  it('empty-ring box rejects every point via pointInBoundingBox', () => {
    const box = boundingBox([]);
    expect(pointInBoundingBox(0, 0, box)).toBe(false);
    expect(pointInBoundingBox(-118.4, 33.945, box)).toBe(false);
  });
});

describe('pointInBoundingBox', () => {
  const box = { minLon: -118.42, maxLon: -118.38, minLat: 33.93, maxLat: 33.96 };

  it('returns true for a point inside', () => {
    expect(pointInBoundingBox(-118.4, 33.945, box)).toBe(true);
  });

  it('returns true for a point on the edge', () => {
    expect(pointInBoundingBox(box.minLon, box.minLat, box)).toBe(true);
    expect(pointInBoundingBox(box.maxLon, box.maxLat, box)).toBe(true);
  });

  it('returns false for a point outside (west)', () => {
    expect(pointInBoundingBox(-118.5, 33.945, box)).toBe(false);
  });

  it('returns false for a point outside (east)', () => {
    expect(pointInBoundingBox(-118.3, 33.945, box)).toBe(false);
  });

  it('returns false for a point outside (north)', () => {
    expect(pointInBoundingBox(-118.4, 34.0, box)).toBe(false);
  });

  it('returns false for a point outside (south)', () => {
    expect(pointInBoundingBox(-118.4, 33.9, box)).toBe(false);
  });
});
