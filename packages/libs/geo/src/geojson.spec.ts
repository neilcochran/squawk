import type { Polygon } from 'geojson';
import { describe, it, expect } from 'vitest';

import {
  boundingBoxesOverlap,
  pointInBoundingBox,
  pointInPolygon,
  polygonBoundingBox,
  polygonCentroid,
  polygonsIdentical,
  polygonsSubstantiallyOverlap,
} from './geojson.js';

/** Simple square polygon: corners at (0,0), (10,0), (10,10), (0,10). */
const square: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
  ],
};

/** Square with a centered square hole at (3..7, 3..7). */
const squareWithHole: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
    [
      [3, 3],
      [7, 3],
      [7, 7],
      [3, 7],
      [3, 3],
    ],
  ],
};

/** Empty polygon: type-correct but with no rings. */
const emptyPolygon: Polygon = {
  type: 'Polygon',
  coordinates: [],
};

describe('pointInPolygon', () => {
  it('returns true for a point inside the outer ring', () => {
    expect(pointInPolygon([5, 5], square)).toBe(true);
  });

  it('returns false for a point outside the outer ring', () => {
    expect(pointInPolygon([15, 5], square)).toBe(false);
  });

  it('treats a point inside a hole as outside the polygon', () => {
    expect(pointInPolygon([5, 5], squareWithHole)).toBe(false);
  });

  it('returns true for a point inside the outer ring but outside the hole', () => {
    expect(pointInPolygon([1, 1], squareWithHole)).toBe(true);
  });

  it('returns false for a polygon with no rings', () => {
    expect(pointInPolygon([0, 0], emptyPolygon)).toBe(false);
  });
});

describe('polygonCentroid', () => {
  it('returns the mean of outer-ring vertices', () => {
    const centroid = polygonCentroid(square);
    expect(centroid).toEqual([4, 4]);
  });

  it('ignores hole rings when computing the centroid', () => {
    const outerOnly = polygonCentroid(square);
    const withHole = polygonCentroid(squareWithHole);
    expect(outerOnly).toEqual(withHole);
  });

  it('returns undefined for an empty polygon', () => {
    expect(polygonCentroid(emptyPolygon)).toBe(undefined);
  });

  it('returns undefined when the outer ring exists but has no usable coords', () => {
    const degenerate: Polygon = {
      type: 'Polygon',
      coordinates: [[]],
    };
    expect(polygonCentroid(degenerate)).toBe(undefined);
  });
});

describe('polygonBoundingBox', () => {
  it('returns the bbox of the outer ring for a simple polygon', () => {
    expect(polygonBoundingBox(square)).toEqual({
      minLon: 0,
      maxLon: 10,
      minLat: 0,
      maxLat: 10,
    });
  });

  it('returns the same bbox whether or not holes are present (holes do not shrink it)', () => {
    expect(polygonBoundingBox(square)).toEqual(polygonBoundingBox(squareWithHole));
  });

  it('returns a degenerate (Infinity) bbox for an empty polygon', () => {
    const bbox = polygonBoundingBox(emptyPolygon);
    expect(bbox.minLon).toBe(Infinity);
    expect(bbox.minLat).toBe(Infinity);
    expect(bbox.maxLon).toBe(-Infinity);
    expect(bbox.maxLat).toBe(-Infinity);
  });
});

describe('polygonsIdentical', () => {
  it('returns true for the same polygon compared with itself', () => {
    expect(polygonsIdentical(square, square)).toBe(true);
  });

  it('returns false when ring counts differ', () => {
    expect(polygonsIdentical(square, squareWithHole)).toBe(false);
  });

  it('returns false when vertex counts differ', () => {
    const triangle: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [5, 10],
          [0, 0],
        ],
      ],
    };
    expect(polygonsIdentical(square, triangle)).toBe(false);
  });

  it('returns false when a single vertex differs', () => {
    const shifted: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 11],
          [0, 0],
        ],
      ],
    };
    expect(polygonsIdentical(square, shifted)).toBe(false);
  });
});

describe('polygonsSubstantiallyOverlap', () => {
  it('returns true for identical polygons', () => {
    expect(polygonsSubstantiallyOverlap(square, square)).toBe(true);
  });

  it('returns true when a small polygon is contained inside a large one', () => {
    const small: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
          [4, 4],
        ],
      ],
    };
    expect(polygonsSubstantiallyOverlap(square, small)).toBe(true);
  });

  it('returns false for disjoint polygons', () => {
    const distant: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [100, 100],
          [110, 100],
          [110, 110],
          [100, 110],
          [100, 100],
        ],
      ],
    };
    expect(polygonsSubstantiallyOverlap(square, distant)).toBe(false);
  });

  it('honours the pre-computed aCentroid shortcut', () => {
    const containing: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-100, -100],
          [100, -100],
          [100, 100],
          [-100, 100],
          [-100, -100],
        ],
      ],
    };
    expect(polygonsSubstantiallyOverlap(square, containing, [4, 4])).toBe(true);
  });
});

describe('boundingBoxesOverlap', () => {
  it('returns true for overlapping boxes', () => {
    expect(
      boundingBoxesOverlap(
        { minLon: 0, maxLon: 10, minLat: 0, maxLat: 10 },
        { minLon: 5, maxLon: 15, minLat: 5, maxLat: 15 },
      ),
    ).toBe(true);
  });

  it('returns true for boxes that share only an edge', () => {
    expect(
      boundingBoxesOverlap(
        { minLon: 0, maxLon: 10, minLat: 0, maxLat: 10 },
        { minLon: 10, maxLon: 20, minLat: 0, maxLat: 10 },
      ),
    ).toBe(true);
  });

  it('returns false for disjoint boxes', () => {
    expect(
      boundingBoxesOverlap(
        { minLon: 0, maxLon: 10, minLat: 0, maxLat: 10 },
        { minLon: 11, maxLon: 20, minLat: 11, maxLat: 20 },
      ),
    ).toBe(false);
  });
});

describe('pointInBoundingBox', () => {
  const bbox = { minLon: 0, maxLon: 10, minLat: 0, maxLat: 10 };

  it('returns true for a point inside the box', () => {
    expect(pointInBoundingBox([5, 5], bbox)).toBe(true);
  });

  it('returns true for a point on the edge of the box', () => {
    expect(pointInBoundingBox([0, 5], bbox)).toBe(true);
  });

  it('returns false for a point outside the box', () => {
    expect(pointInBoundingBox([11, 5], bbox)).toBe(false);
  });
});
