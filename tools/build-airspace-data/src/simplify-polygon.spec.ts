import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import type { Polygon } from 'geojson';
import { simplifyPolygon } from './simplify-polygon.js';

describe('simplifyPolygon', () => {
  it('leaves a small ring (<4 points) unchanged', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [0, 0],
        ],
      ],
    };
    const result = simplifyPolygon(polygon, 0.1);
    assert.deepEqual(result.coordinates, polygon.coordinates);
  });

  it('preserves first and last points (ring closure)', () => {
    const ring: number[][] = [
      [0, 0],
      [0.1, 0.0001],
      [0.5, 0.0002],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    const polygon: Polygon = { type: 'Polygon', coordinates: [ring] };

    const simplified = simplifyPolygon(polygon, 0.001);
    const simplifiedRing = simplified.coordinates[0]!;
    assert.deepEqual(simplifiedRing[0], [0, 0]);
    assert.deepEqual(simplifiedRing[simplifiedRing.length - 1], [0, 0]);
  });

  it('removes colinear points within tolerance', () => {
    const ring: number[][] = [
      [0, 0],
      [0.25, 0],
      [0.5, 0],
      [0.75, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const polygon: Polygon = { type: 'Polygon', coordinates: [ring] };

    const simplified = simplifyPolygon(polygon, 0.001);
    const simplifiedRing = simplified.coordinates[0]!;
    assert.ok(simplifiedRing.length < ring.length);
    assert.ok(simplifiedRing.length >= 4);
  });

  it('keeps points that deviate more than the tolerance', () => {
    const ring: number[][] = [
      [0, 0],
      [0.5, 0.1],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const polygon: Polygon = { type: 'Polygon', coordinates: [ring] };

    const simplified = simplifyPolygon(polygon, 0.01);
    const simplifiedRing = simplified.coordinates[0]!;
    const hasMidBump = simplifiedRing.some((c) => c[0] === 0.5 && c[1] === 0.1);
    assert.ok(hasMidBump, 'significant deviation should be preserved');
  });

  it('falls back to the original ring if simplification would drop below 4 points', () => {
    const ring: number[][] = [
      [0, 0],
      [0.25, 0.0000001],
      [0.5, 0.0000002],
      [0.75, 0.0000003],
      [1, 0.0000004],
      [0, 0],
    ];
    const polygon: Polygon = { type: 'Polygon', coordinates: [ring] };

    const simplified = simplifyPolygon(polygon, 0.5);
    assert.deepEqual(simplified.coordinates[0], ring);
  });

  it('returns a new polygon object', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    };
    const result = simplifyPolygon(polygon, 0.001);
    assert.notEqual(result, polygon);
    assert.equal(result.type, 'Polygon');
  });

  it('handles multiple rings (exterior + holes)', () => {
    const polygon: Polygon = {
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
          [2, 2],
          [8, 2],
          [8, 8],
          [2, 8],
          [2, 2],
        ],
      ],
    };
    const simplified = simplifyPolygon(polygon, 0.001);
    assert.equal(simplified.coordinates.length, 2);
  });
});
