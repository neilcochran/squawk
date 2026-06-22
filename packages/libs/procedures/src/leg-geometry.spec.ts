import assert from 'node:assert/strict';

import { describe, it } from 'vitest';

import type { ProcedureLeg, ProcedureLegPathTerminator } from '@squawk/types';

import { expansionToLineString, extractLegPoints } from './leg-geometry.js';

/** Builds a fix-terminated leg at a coordinate. */
function fixLeg(
  fixIdentifier: string,
  lat: number,
  lon: number,
  pathTerminator: ProcedureLegPathTerminator = 'TF',
): ProcedureLeg {
  return { pathTerminator, fixIdentifier, lat, lon };
}

/** Builds a non-positional leg (terminates at an altitude, intercept, etc.). */
function nonPositionalLeg(pathTerminator: ProcedureLegPathTerminator): ProcedureLeg {
  return { pathTerminator };
}

// ---------------------------------------------------------------------------
// extractLegPoints
// ---------------------------------------------------------------------------

describe('extractLegPoints', () => {
  it('returns an empty array for an empty leg sequence', () => {
    assert.deepEqual(extractLegPoints([]), []);
  });

  it('returns label/lat/lon for fix-terminated legs in order', () => {
    const points = extractLegPoints([
      fixLeg('ALPHA', 40.0, -74.0, 'IF'),
      fixLeg('BRAVO', 40.5, -74.0),
      fixLeg('CHRLI', 41.0, -74.0),
    ]);

    assert.deepEqual(points, [
      { label: 'ALPHA', lat: 40.0, lon: -74.0 },
      { label: 'BRAVO', lat: 40.5, lon: -74.0 },
      { label: 'CHRLI', lat: 41.0, lon: -74.0 },
    ]);
  });

  it('skips non-positional legs that lack a fix coordinate', () => {
    const points = extractLegPoints([
      fixLeg('RW34', 40.0, -74.0, 'IF'),
      nonPositionalLeg('CA'),
      nonPositionalLeg('VA'),
      fixLeg('TOPPP', 40.5, -74.0, 'DF'),
    ]);

    assert.deepEqual(
      points.map((p) => p.label),
      ['RW34', 'TOPPP'],
    );
  });

  it('skips a leg that carries a fix identifier but no coordinates', () => {
    const points = extractLegPoints([
      fixLeg('ALPHA', 40.0, -74.0),
      { pathTerminator: 'CF', fixIdentifier: 'NOCRD' },
      fixLeg('BRAVO', 41.0, -74.0),
    ]);

    assert.deepEqual(
      points.map((p) => p.label),
      ['ALPHA', 'BRAVO'],
    );
  });

  it('suppresses consecutive duplicate points (e.g. a hold over the prior fix)', () => {
    const points = extractLegPoints([
      fixLeg('HOLDR', 40.0, -74.0, 'TF'),
      fixLeg('HOLDR', 40.0, -74.0, 'HF'),
      fixLeg('NEXTT', 41.0, -74.0),
    ]);

    assert.deepEqual(
      points.map((p) => p.label),
      ['HOLDR', 'NEXTT'],
    );
  });

  it('keeps a later point that revisits an earlier non-consecutive coordinate', () => {
    const points = extractLegPoints([
      fixLeg('A', 40.0, -74.0),
      fixLeg('B', 41.0, -74.0),
      fixLeg('A2', 40.0, -74.0),
    ]);

    assert.equal(points.length, 3);
  });
});

// ---------------------------------------------------------------------------
// expansionToLineString
// ---------------------------------------------------------------------------

describe('expansionToLineString', () => {
  it('builds a LineString with [lon, lat] coordinates', () => {
    const line = expansionToLineString([fixLeg('A', 40.0, -74.0), fixLeg('B', 41.0, -73.0)]);

    assert.deepEqual(line, {
      type: 'LineString',
      coordinates: [
        [-74.0, 40.0],
        [-73.0, 41.0],
      ],
    });
  });

  it('returns undefined for an empty leg sequence', () => {
    assert.equal(expansionToLineString([]), undefined);
  });

  it('returns undefined when only one leg is drawable', () => {
    assert.equal(
      expansionToLineString([fixLeg('SOLO', 40.0, -74.0), nonPositionalLeg('VM')]),
      undefined,
    );
  });

  it('returns undefined when every leg is non-positional', () => {
    assert.equal(
      expansionToLineString([
        nonPositionalLeg('CA'),
        nonPositionalLeg('VA'),
        nonPositionalLeg('FM'),
      ]),
      undefined,
    );
  });
});
