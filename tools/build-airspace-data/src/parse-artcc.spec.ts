import { describe, it, expect } from 'vitest';
import { resolveStratum, splitClosedShapes, type ArtccSegPoint } from './parse-artcc.js';

describe('resolveStratum', () => {
  it('returns LOW for ALTITUDE=LOW + TYPE=ARTCC', () => {
    expect(resolveStratum('LOW', 'ARTCC')).toBe('LOW');
  });

  it('returns HIGH for ALTITUDE=HIGH + TYPE=ARTCC', () => {
    expect(resolveStratum('HIGH', 'ARTCC')).toBe('HIGH');
  });

  it('returns UTA for ALTITUDE=UNLIMITED + TYPE=UTA', () => {
    expect(resolveStratum('UNLIMITED', 'UTA')).toBe('UTA');
  });

  it('returns CTA for ALTITUDE=UNLIMITED + TYPE=CTA', () => {
    expect(resolveStratum('UNLIMITED', 'CTA')).toBe('CTA');
  });

  it('returns FIR for ALTITUDE=UNLIMITED + TYPE=FIR', () => {
    expect(resolveStratum('UNLIMITED', 'FIR')).toBe('FIR');
  });

  it('returns CTA/FIR for ALTITUDE=UNLIMITED + TYPE=CTA/FIR', () => {
    expect(resolveStratum('UNLIMITED', 'CTA/FIR')).toBe('CTA/FIR');
  });

  it('returns undefined for unknown ALTITUDE values', () => {
    expect(resolveStratum('SUPER_HIGH', 'ARTCC')).toBe(undefined);
  });

  it('returns undefined for unknown TYPE values within UNLIMITED', () => {
    expect(resolveStratum('UNLIMITED', 'CTR')).toBe(undefined);
  });

  it('returns undefined for HIGH paired with a non-ARTCC type', () => {
    expect(resolveStratum('HIGH', 'UTA')).toBe(undefined);
  });

  it('returns undefined for empty inputs', () => {
    expect(resolveStratum('', '')).toBe(undefined);
  });
});

describe('splitClosedShapes', () => {
  function point(seq: number, lon: number, lat: number, description: string): ArtccSegPoint {
    return { pointSeq: seq, lon, lat, description };
  }

  it('emits one closed ring for a simple POINT-OF-BEGINNING-terminated shape', () => {
    const shapes = splitClosedShapes([
      point(10, 0, 0, 'TO'),
      point(20, 10, 0, 'TO'),
      point(30, 10, 10, 'TO'),
      point(40, 0, 10, 'TO POINT OF BEGINNING'),
    ]);
    expect(shapes.length).toBe(1);
    const ring = shapes[0]!;
    // The 4 input points + 1 closing duplicate = 5 vertices
    expect(ring.length).toBe(5);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring[0]).toEqual([0, 0]);
  });

  it('emits multiple closed rings when a stratum has multiple shapes', () => {
    const shapes = splitClosedShapes([
      point(10, 0, 0, 'TO'),
      point(20, 5, 0, 'TO'),
      point(30, 5, 5, 'TO POINT OF BEGINNING'),
      point(40, 100, 0, 'TO'),
      point(50, 105, 0, 'TO'),
      point(60, 105, 5, 'TO POINT OF BEGINNING.'),
    ]);
    expect(shapes.length).toBe(2);
    expect(shapes[0]![0]).toEqual([0, 0]);
    expect(shapes[1]![0]).toEqual([100, 0]);
  });

  it('matches the marker case-insensitively and tolerates trailing punctuation', () => {
    const shapes = splitClosedShapes([
      point(10, 0, 0, 'TO'),
      point(20, 1, 0, 'TO'),
      point(30, 1, 1, 'to point of beginning.'),
    ]);
    expect(shapes.length).toBe(1);
  });

  it('matches the marker when embedded in a longer description', () => {
    const shapes = splitClosedShapes([
      point(10, 0, 0, 'TO'),
      point(20, 1, 0, 'TO'),
      point(30, 1, 1, '/COMMON ZAB-ZDV/ TO POINT OF BEGINNING'),
    ]);
    expect(shapes.length).toBe(1);
  });

  it('implicitly closes a trailing shape that lacks the marker', () => {
    const shapes = splitClosedShapes([
      point(10, 0, 0, 'TO'),
      point(20, 1, 0, 'TO'),
      point(30, 1, 1, 'TO'),
    ]);
    expect(shapes.length).toBe(1);
    const ring = shapes[0]!;
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('returns no shapes when the input is empty', () => {
    expect(splitClosedShapes([])).toEqual([]);
  });

  it('does not append a closing duplicate when first equals last', () => {
    const shapes = splitClosedShapes([
      point(10, 0, 0, 'TO'),
      point(20, 1, 0, 'TO'),
      point(30, 1, 1, 'TO'),
      point(40, 0, 0, 'TO POINT OF BEGINNING'),
    ]);
    expect(shapes.length).toBe(1);
    // 4 points + no extra duplicate since the last is already (0,0)
    expect(shapes[0]!.length).toBe(4);
  });
});
