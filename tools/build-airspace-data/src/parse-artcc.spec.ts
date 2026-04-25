import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStratum, splitClosedShapes, type ArtccSegPoint } from './parse-artcc.js';

describe('resolveStratum', () => {
  it('returns LOW for ALTITUDE=LOW + TYPE=ARTCC', () => {
    assert.equal(resolveStratum('LOW', 'ARTCC'), 'LOW');
  });

  it('returns HIGH for ALTITUDE=HIGH + TYPE=ARTCC', () => {
    assert.equal(resolveStratum('HIGH', 'ARTCC'), 'HIGH');
  });

  it('returns UTA for ALTITUDE=UNLIMITED + TYPE=UTA', () => {
    assert.equal(resolveStratum('UNLIMITED', 'UTA'), 'UTA');
  });

  it('returns CTA for ALTITUDE=UNLIMITED + TYPE=CTA', () => {
    assert.equal(resolveStratum('UNLIMITED', 'CTA'), 'CTA');
  });

  it('returns FIR for ALTITUDE=UNLIMITED + TYPE=FIR', () => {
    assert.equal(resolveStratum('UNLIMITED', 'FIR'), 'FIR');
  });

  it('returns CTA/FIR for ALTITUDE=UNLIMITED + TYPE=CTA/FIR', () => {
    assert.equal(resolveStratum('UNLIMITED', 'CTA/FIR'), 'CTA/FIR');
  });

  it('returns undefined for unknown ALTITUDE values', () => {
    assert.equal(resolveStratum('SUPER_HIGH', 'ARTCC'), undefined);
  });

  it('returns undefined for unknown TYPE values within UNLIMITED', () => {
    assert.equal(resolveStratum('UNLIMITED', 'CTR'), undefined);
  });

  it('returns undefined for HIGH paired with a non-ARTCC type', () => {
    assert.equal(resolveStratum('HIGH', 'UTA'), undefined);
  });

  it('returns undefined for empty inputs', () => {
    assert.equal(resolveStratum('', ''), undefined);
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
    assert.equal(shapes.length, 1);
    const ring = shapes[0]!;
    // The 4 input points + 1 closing duplicate = 5 vertices
    assert.equal(ring.length, 5);
    assert.deepEqual(ring[0], ring[ring.length - 1]);
    assert.deepEqual(ring[0], [0, 0]);
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
    assert.equal(shapes.length, 2);
    assert.deepEqual(shapes[0]![0], [0, 0]);
    assert.deepEqual(shapes[1]![0], [100, 0]);
  });

  it('matches the marker case-insensitively and tolerates trailing punctuation', () => {
    const shapes = splitClosedShapes([
      point(10, 0, 0, 'TO'),
      point(20, 1, 0, 'TO'),
      point(30, 1, 1, 'to point of beginning.'),
    ]);
    assert.equal(shapes.length, 1);
  });

  it('matches the marker when embedded in a longer description', () => {
    const shapes = splitClosedShapes([
      point(10, 0, 0, 'TO'),
      point(20, 1, 0, 'TO'),
      point(30, 1, 1, '/COMMON ZAB-ZDV/ TO POINT OF BEGINNING'),
    ]);
    assert.equal(shapes.length, 1);
  });

  it('implicitly closes a trailing shape that lacks the marker', () => {
    const shapes = splitClosedShapes([
      point(10, 0, 0, 'TO'),
      point(20, 1, 0, 'TO'),
      point(30, 1, 1, 'TO'),
    ]);
    assert.equal(shapes.length, 1);
    const ring = shapes[0]!;
    assert.deepEqual(ring[0], ring[ring.length - 1]);
  });

  it('returns no shapes when the input is empty', () => {
    assert.deepEqual(splitClosedShapes([]), []);
  });

  it('does not append a closing duplicate when first equals last', () => {
    const shapes = splitClosedShapes([
      point(10, 0, 0, 'TO'),
      point(20, 1, 0, 'TO'),
      point(30, 1, 1, 'TO'),
      point(40, 0, 0, 'TO POINT OF BEGINNING'),
    ]);
    assert.equal(shapes.length, 1);
    // 4 points + no extra duplicate since the last is already (0,0)
    assert.equal(shapes[0]!.length, 4);
  });
});
