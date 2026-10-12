import type { Polygon } from 'geojson';
import { describe, it, expect } from 'vitest';

import { normalizeWinding, removeDuplicateVertices } from './normalize-polygon.js';

/** A unit square traced counterclockwise (RFC 7946 exterior orientation). */
const CCW_SQUARE: number[][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
];

/** The same square traced clockwise. */
const CW_SQUARE: number[][] = [...CCW_SQUARE].reverse();

describe('normalizeWinding', () => {
  it('reverses a clockwise exterior ring', () => {
    const polygon: Polygon = { type: 'Polygon', coordinates: [CW_SQUARE] };
    expect(normalizeWinding(polygon).coordinates[0]).toEqual(CCW_SQUARE);
  });

  it('leaves a counterclockwise exterior ring alone', () => {
    const polygon: Polygon = { type: 'Polygon', coordinates: [CCW_SQUARE] };
    expect(normalizeWinding(polygon).coordinates[0]).toBe(CCW_SQUARE);
  });

  it('orients holes clockwise', () => {
    const ccwHole: number[][] = [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.75, 0.75],
      [0.25, 0.75],
      [0.25, 0.25],
    ];
    const polygon: Polygon = { type: 'Polygon', coordinates: [CW_SQUARE, ccwHole] };
    const normalized = normalizeWinding(polygon);
    expect(normalized.coordinates[0]).toEqual(CCW_SQUARE);
    expect(normalized.coordinates[1]).toEqual([...ccwHole].reverse());
  });

  it('measures orientation from the positions that have two coordinates', () => {
    const ring: number[][] = [[0, 0], [0, 1], [1, 1], [], [1, 0], [0, 0]];
    const polygon: Polygon = { type: 'Polygon', coordinates: [ring] };
    expect(normalizeWinding(polygon).coordinates[0]).toEqual([...ring].reverse());
  });
});

describe('removeDuplicateVertices', () => {
  it('drops consecutive duplicate positions and keeps the ring closed', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 0],
          [1, 1],
          [1, 1],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    };
    expect(removeDuplicateVertices(polygon).coordinates[0]).toEqual(CCW_SQUARE);
  });

  it('drops a vertex that repeats the first position before the closing one', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
          [0, 0],
        ],
      ],
    };
    expect(removeDuplicateVertices(polygon).coordinates[0]).toEqual(CCW_SQUARE);
  });

  it('closes a ring whose last position does not repeat the first', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      ],
    };
    expect(removeDuplicateVertices(polygon).coordinates[0]).toEqual(CCW_SQUARE);
  });

  it('returns a ring unchanged when deduplication would leave fewer than four positions', () => {
    const degenerate: number[][] = [
      [0, 0],
      [0, 0],
      [1, 1],
      [0, 0],
    ];
    const polygon: Polygon = { type: 'Polygon', coordinates: [degenerate] };
    expect(removeDuplicateVertices(polygon).coordinates[0]).toBe(degenerate);
  });

  it('returns a ring with fewer than four positions unchanged', () => {
    const open: number[][] = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    const polygon: Polygon = { type: 'Polygon', coordinates: [open] };
    expect(removeDuplicateVertices(polygon).coordinates[0]).toBe(open);
  });

  it('leaves a clean ring alone', () => {
    const polygon: Polygon = { type: 'Polygon', coordinates: [CCW_SQUARE] };
    expect(removeDuplicateVertices(polygon).coordinates[0]).toEqual(CCW_SQUARE);
  });
});
