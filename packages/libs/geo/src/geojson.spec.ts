import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Polygon } from 'geojson';
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
    assert.equal(pointInPolygon([5, 5], square), true);
  });

  it('returns false for a point outside the outer ring', () => {
    assert.equal(pointInPolygon([15, 5], square), false);
  });

  it('treats a point inside a hole as outside the polygon', () => {
    assert.equal(pointInPolygon([5, 5], squareWithHole), false);
  });

  it('returns true for a point inside the outer ring but outside the hole', () => {
    assert.equal(pointInPolygon([1, 1], squareWithHole), true);
  });

  it('returns false for a polygon with no rings', () => {
    assert.equal(pointInPolygon([0, 0], emptyPolygon), false);
  });
});

describe('polygonCentroid', () => {
  it('returns the mean of outer-ring vertices', () => {
    const centroid = polygonCentroid(square);
    assert.deepEqual(centroid, [4, 4]);
  });

  it('ignores hole rings when computing the centroid', () => {
    const outerOnly = polygonCentroid(square);
    const withHole = polygonCentroid(squareWithHole);
    assert.deepEqual(outerOnly, withHole);
  });

  it('returns undefined for an empty polygon', () => {
    assert.equal(polygonCentroid(emptyPolygon), undefined);
  });

  it('returns undefined when the outer ring exists but has no usable coords', () => {
    const degenerate: Polygon = {
      type: 'Polygon',
      coordinates: [[]],
    };
    assert.equal(polygonCentroid(degenerate), undefined);
  });
});

describe('polygonBoundingBox', () => {
  it('returns the bbox of the outer ring for a simple polygon', () => {
    assert.deepEqual(polygonBoundingBox(square), {
      minLon: 0,
      maxLon: 10,
      minLat: 0,
      maxLat: 10,
    });
  });

  it('returns the same bbox whether or not holes are present (holes do not shrink it)', () => {
    assert.deepEqual(polygonBoundingBox(square), polygonBoundingBox(squareWithHole));
  });

  it('returns a degenerate (Infinity) bbox for an empty polygon', () => {
    const bbox = polygonBoundingBox(emptyPolygon);
    assert.equal(bbox.minLon, Infinity);
    assert.equal(bbox.minLat, Infinity);
    assert.equal(bbox.maxLon, -Infinity);
    assert.equal(bbox.maxLat, -Infinity);
  });
});

describe('polygonsIdentical', () => {
  it('returns true for the same polygon compared with itself', () => {
    assert.equal(polygonsIdentical(square, square), true);
  });

  it('returns false when ring counts differ', () => {
    assert.equal(polygonsIdentical(square, squareWithHole), false);
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
    assert.equal(polygonsIdentical(square, triangle), false);
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
    assert.equal(polygonsIdentical(square, shifted), false);
  });
});

describe('polygonsSubstantiallyOverlap', () => {
  it('returns true for identical polygons', () => {
    assert.equal(polygonsSubstantiallyOverlap(square, square), true);
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
    assert.equal(polygonsSubstantiallyOverlap(square, small), true);
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
    assert.equal(polygonsSubstantiallyOverlap(square, distant), false);
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
    assert.equal(polygonsSubstantiallyOverlap(square, containing, [4, 4]), true);
  });
});

describe('boundingBoxesOverlap', () => {
  it('returns true for overlapping boxes', () => {
    assert.equal(
      boundingBoxesOverlap(
        { minLon: 0, maxLon: 10, minLat: 0, maxLat: 10 },
        { minLon: 5, maxLon: 15, minLat: 5, maxLat: 15 },
      ),
      true,
    );
  });

  it('returns true for boxes that share only an edge', () => {
    assert.equal(
      boundingBoxesOverlap(
        { minLon: 0, maxLon: 10, minLat: 0, maxLat: 10 },
        { minLon: 10, maxLon: 20, minLat: 0, maxLat: 10 },
      ),
      true,
    );
  });

  it('returns false for disjoint boxes', () => {
    assert.equal(
      boundingBoxesOverlap(
        { minLon: 0, maxLon: 10, minLat: 0, maxLat: 10 },
        { minLon: 11, maxLon: 20, minLat: 11, maxLat: 20 },
      ),
      false,
    );
  });
});

describe('pointInBoundingBox', () => {
  const bbox = { minLon: 0, maxLon: 10, minLat: 0, maxLat: 10 };

  it('returns true for a point inside the box', () => {
    assert.equal(pointInBoundingBox([5, 5], bbox), true);
  });

  it('returns true for a point on the edge of the box', () => {
    assert.equal(pointInBoundingBox([0, 5], bbox), true);
  });

  it('returns false for a point outside the box', () => {
    assert.equal(pointInBoundingBox([11, 5], bbox), false);
  });
});
