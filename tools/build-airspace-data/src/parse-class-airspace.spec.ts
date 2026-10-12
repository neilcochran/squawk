import type { MultiPolygon, Polygon } from 'geojson';
import { describe, it, expect } from 'vitest';

import { dbfString, extractPolygons } from './parse-class-airspace.js';

describe('dbfString', () => {
  it('returns trimmed text for a real value', () => {
    expect(dbfString('RDR ')).toBe('RDR');
  });

  it('treats null, blank and the <Null> placeholder as absent', () => {
    expect(dbfString(null)).toBe(null);
    expect(dbfString(undefined)).toBe(null);
    expect(dbfString('')).toBe(null);
    expect(dbfString('   ')).toBe(null);
    expect(dbfString('<Null>')).toBe(null);
  });
});

describe('extractPolygons', () => {
  const square = (offset: number): number[][] => [
    [offset, 0],
    [offset + 1, 0],
    [offset + 1, 1],
    [offset, 1],
    [offset, 0],
  ];

  it('returns a Polygon as is', () => {
    const polygon: Polygon = { type: 'Polygon', coordinates: [square(0)] };
    expect(extractPolygons(polygon, 'TEST')).toEqual([polygon]);
  });

  it('returns one Polygon per MultiPolygon part, keeping every part', () => {
    // The Florida Class E5 area is a peninsula part plus the detached Key
    // West part; both must survive, however small the second one is.
    const multi: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [[square(0)], [square(10)]],
    };
    const parts = extractPolygons(multi, 'FLORIDA CLASS E5');
    expect(parts.length).toBe(2);
    expect(parts[0]).toEqual({ type: 'Polygon', coordinates: [square(0)] });
    expect(parts[1]).toEqual({ type: 'Polygon', coordinates: [square(10)] });
  });

  it('keeps holes with their part', () => {
    const hole: number[][] = [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.75, 0.75],
      [0.25, 0.75],
      [0.25, 0.25],
    ];
    const multi: MultiPolygon = { type: 'MultiPolygon', coordinates: [[square(0), hole]] };
    expect(extractPolygons(multi, 'TEST')[0]?.coordinates).toEqual([square(0), hole]);
  });
});
