import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { splitAtAntimeridian } from './split-antimeridian.js';

describe('splitAtAntimeridian', () => {
  it('returns the input ring unchanged when there is no antimeridian crossing', () => {
    const ring: [number, number][] = [
      [-100, 30],
      [-90, 30],
      [-90, 40],
      [-100, 40],
      [-100, 30],
    ];
    const result = splitAtAntimeridian(ring);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0], ring);
  });

  it('splits a ring straddling the antimeridian into one east and one west sub-ring', () => {
    // Rectangle straddling 180: 170E to -170W, 30N to 40N. Width 20 (10 either side).
    const ring: [number, number][] = [
      [170, 30],
      [175, 30],
      [-175, 30],
      [-170, 30],
      [-170, 40],
      [-175, 40],
      [175, 40],
      [170, 40],
      [170, 30],
    ];
    const result = splitAtAntimeridian(ring);
    assert.equal(result.length, 2, 'expected two sub-rings');

    for (const sub of result) {
      for (const [lon] of sub) {
        assert.ok(lon >= -180 && lon <= 180, `lon ${lon} out of range`);
      }
      assert.deepEqual(sub[0], sub[sub.length - 1], 'sub-ring must be closed');
    }

    const eastSide = result.find((sub) => sub.some(([lon]) => lon === 180));
    const westSide = result.find((sub) => sub.some(([lon]) => lon === -180));
    assert.ok(eastSide, 'expected a sub-ring with lon=180 vertices');
    assert.ok(westSide, 'expected a sub-ring with lon=-180 vertices');
    assert.ok(
      eastSide.every(([lon]) => lon >= 170 && lon <= 180),
      'eastern sub-ring should stay between 170E and 180',
    );
    assert.ok(
      westSide.every(([lon]) => lon >= -180 && lon <= -170),
      'western sub-ring should stay between -180 and -170W',
    );
  });

  it('preserves vertices that already sit exactly on the antimeridian', () => {
    // Ring with explicit vertices at lon=180 - should not be duplicated or lost
    const ring: [number, number][] = [
      [170, 30],
      [180, 30],
      [180, 40],
      [170, 40],
      [170, 30],
    ];
    const result = splitAtAntimeridian(ring);
    assert.equal(result.length, 1, 'no crossing means no split');
    const sub = result[0]!;
    const onLine = sub.filter(([lon]) => lon === 180);
    assert.ok(onLine.length >= 2, 'lon=180 vertices should be preserved in output');
  });

  it('emits sub-rings whose interior contains at least one input vertex (split correctness)', () => {
    // Rectangle 130E to -130W, 20N to 50N. Each sub-ring should contain at
    // least one of the original vertices (apart from antimeridian crossings).
    const ring: [number, number][] = [
      [130, 20],
      [-130, 20],
      [-130, 50],
      [130, 50],
      [130, 20],
    ];
    const result = splitAtAntimeridian(ring);
    assert.equal(result.length, 2);

    const east = result.find((sub) => sub.some(([lon]) => lon === 180))!;
    const west = result.find((sub) => sub.some(([lon]) => lon === -180))!;

    assert.ok(
      east.some(([lon, lat]) => lon === 130 && lat === 20),
      'eastern sub-ring should retain original vertex (130, 20)',
    );
    assert.ok(
      west.some(([lon, lat]) => lon === -130 && lat === 20),
      'western sub-ring should retain original vertex (-130, 20)',
    );
  });

  it('splits a Pacific-spanning ring into two sub-rings at the antimeridian', () => {
    // ZAK-like ring: rectangle from 130E across the Pacific to -130W
    const ring: [number, number][] = [
      [130, 20],
      [-130, 20],
      [-130, 50],
      [130, 50],
      [130, 20],
    ];
    const result = splitAtAntimeridian(ring);
    assert.equal(result.length, 2, 'expected two sub-rings');

    for (const sub of result) {
      for (const [lon, lat] of sub) {
        assert.ok(lon >= -180 && lon <= 180, `lon ${lon} out of range`);
        assert.ok(lat >= -90 && lat <= 90, `lat ${lat} out of range`);
      }
      assert.deepEqual(sub[0], sub[sub.length - 1], 'sub-ring must be closed');
    }

    // One sub-ring should hug the antimeridian on the eastern side (lon=180 vertices)
    const eastSide = result.find((sub) => sub.some(([lon]) => lon === 180));
    assert.ok(eastSide, 'expected a sub-ring with lon=180 vertices');
    assert.ok(
      eastSide.every(([lon]) => lon >= 130 || lon === 180),
      'eastern sub-ring should stay east of 130E',
    );

    // The other should hug the antimeridian on the western side (lon=-180 vertices)
    const westSide = result.find((sub) => sub.some(([lon]) => lon === -180));
    assert.ok(westSide, 'expected a sub-ring with lon=-180 vertices');
    assert.ok(
      westSide.every(([lon]) => lon <= -130 || lon === -180),
      'western sub-ring should stay west of -130W',
    );
  });

  it('returns an empty array for a degenerate ring with too few points', () => {
    assert.deepEqual(
      splitAtAntimeridian([
        [0, 0],
        [1, 1],
      ]),
      [],
    );
  });
});
