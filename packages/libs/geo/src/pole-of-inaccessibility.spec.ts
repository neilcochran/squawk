import type { Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';

import { pointInPolygon, polygonCentroid } from './geojson.js';
import { poleOfInaccessibility } from './pole-of-inaccessibility.js';

/** Closed square ring from `(x0, y0)` to `(x1, y1)`. */
function squareRing(x0: number, y0: number, x1: number, y1: number): number[][] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
}

/** Closed ring approximating a circular arc band (an annular sector). */
function sectorRing(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startDeg: number,
  endDeg: number,
): number[][] {
  const ring: number[][] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = ((startDeg + ((endDeg - startDeg) * i) / steps) * Math.PI) / 180;
    ring.push([cx + outerRadius * Math.cos(a), cy + outerRadius * Math.sin(a)]);
  }
  for (let i = steps; i >= 0; i--) {
    const a = ((startDeg + ((endDeg - startDeg) * i) / steps) * Math.PI) / 180;
    ring.push([cx + innerRadius * Math.cos(a), cy + innerRadius * Math.sin(a)]);
  }
  const first = ring[0];
  if (first !== undefined) {
    ring.push([...first]);
  }
  return ring;
}

describe('poleOfInaccessibility', () => {
  it('returns the center of a square', () => {
    const polygon: Polygon = { type: 'Polygon', coordinates: [squareRing(0, 0, 10, 10)] };
    const pole = poleOfInaccessibility(polygon);
    expect(pole).toBeDefined();
    expect(pole?.[0]).toBeCloseTo(5, 1);
    expect(pole?.[1]).toBeCloseTo(5, 1);
  });

  it('returns a point on the midline of a rectangle, as far from the long edges as possible', () => {
    const polygon: Polygon = { type: 'Polygon', coordinates: [squareRing(0, 0, 40, 20)] };
    const pole = poleOfInaccessibility(polygon, { precision: 0.01 });
    expect(pole).toBeDefined();
    expect(pole?.[1]).toBeCloseTo(10, 1);
    expect(pole?.[0]).toBeGreaterThanOrEqual(10 - 0.05);
    expect(pole?.[0]).toBeLessThanOrEqual(30 + 0.05);
  });

  it('lands inside a crescent-shaped sector whose centroid falls outside the shape', () => {
    // A 300-degree annular band around the origin: the vertex-mean
    // centroid sits in the open middle, outside the band itself.
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [sectorRing(0, 0, 6, 10, 30, 330)],
    };
    const centroid = polygonCentroid(polygon);
    expect(centroid).toBeDefined();
    if (centroid === undefined) {
      throw new Error('expected a centroid');
    }
    expect(pointInPolygon(centroid, polygon)).toBe(false);
    const pole = poleOfInaccessibility(polygon);
    expect(pole).toBeDefined();
    if (pole === undefined) {
      throw new Error('expected a pole');
    }
    expect(pointInPolygon(pole, polygon)).toBe(true);
    // The band is 4 units wide, so the pole sits near its middle radius.
    expect(Math.hypot(pole[0], pole[1])).toBeCloseTo(8, 0);
  });

  it('avoids a hole and lands in the solid part of a ring', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [squareRing(0, 0, 10, 10), squareRing(3, 3, 7, 7)],
    };
    const pole = poleOfInaccessibility(polygon, { precision: 0.01 });
    expect(pole).toBeDefined();
    if (pole === undefined) {
      throw new Error('expected a pole');
    }
    expect(pointInPolygon(pole, polygon)).toBe(true);
    // Every point of the 3-wide band is within 1.5 of an edge; the pole
    // reaches that maximum, so it is at least 1.4 from the hole and the
    // outer edge alike.
    const insideHole = pole[0] > 3 && pole[0] < 7 && pole[1] > 3 && pole[1] < 7;
    expect(insideHole).toBe(false);
  });

  it('tightens toward the exact answer as precision shrinks', () => {
    const polygon: Polygon = { type: 'Polygon', coordinates: [squareRing(0, 0, 100, 100)] };
    const coarse = poleOfInaccessibility(polygon, { precision: 10 });
    const fine = poleOfInaccessibility(polygon, { precision: 0.001 });
    expect(coarse).toBeDefined();
    expect(fine).toBeDefined();
    expect(fine?.[0]).toBeCloseTo(50, 2);
    expect(fine?.[1]).toBeCloseTo(50, 2);
    const coarseError = Math.hypot((coarse?.[0] ?? 0) - 50, (coarse?.[1] ?? 0) - 50);
    const fineError = Math.hypot((fine?.[0] ?? 0) - 50, (fine?.[1] ?? 0) - 50);
    expect(fineError).toBeLessThanOrEqual(coarseError);
  });

  it('returns undefined for a polygon with no outer ring', () => {
    expect(poleOfInaccessibility({ type: 'Polygon', coordinates: [] })).toBeUndefined();
    expect(poleOfInaccessibility({ type: 'Polygon', coordinates: [[]] })).toBeUndefined();
  });

  it('returns undefined for a degenerate polygon with no area', () => {
    const line: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [0, 0],
        ],
      ],
    };
    expect(poleOfInaccessibility(line)).toBeUndefined();
  });

  it('drops positions missing a coordinate and resolves the rest of the ring', () => {
    // With the one-coordinate position removed the ring is the unit
    // square scaled by 10, so the pole is its center.
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [[[0, 0], [10, 0], [10], [10, 10], [0, 10], [0, 0]]],
    };
    const pole = poleOfInaccessibility(polygon, { precision: 0.01 });
    expect(pole).toBeDefined();
    expect(pole?.[0]).toBeCloseTo(5, 1);
    expect(pole?.[1]).toBeCloseTo(5, 1);
  });

  it('seeds from the first vertex when the outer ring winds back on itself with zero area', () => {
    // Zero signed area but a non-degenerate bounding box: a bow-tie whose
    // two lobes cancel. The search still returns a point inside one lobe.
    const bowTie: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [10, 10],
          [10, 0],
          [0, 10],
          [0, 0],
        ],
      ],
    };
    const pole = poleOfInaccessibility(bowTie, { precision: 0.05 });
    expect(pole).toBeDefined();
    expect(pointInPolygon(pole ?? [-1, -1], bowTie)).toBe(true);
  });

  it('throws on a non-positive precision', () => {
    const polygon: Polygon = { type: 'Polygon', coordinates: [squareRing(0, 0, 10, 10)] };
    expect(() => poleOfInaccessibility(polygon, { precision: 0 })).toThrow(RangeError);
    expect(() => poleOfInaccessibility(polygon, { precision: -1 })).toThrow(RangeError);
    expect(() => poleOfInaccessibility(polygon, { precision: Number.NaN })).toThrow(RangeError);
  });
});
