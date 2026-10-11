import { describe, expect, it } from 'vitest';

import {
  CEILING_CAP_FT,
  FT_TO_METERS,
  MAP_ZOOM_QUANTUM,
  buildExtrusionAltitudeExpression,
  extrudedAltitudeMeters,
  extrusionExaggerationForZoom,
  quantizeMapZoom,
} from './airspace-extrusion-scale.ts';

describe('extrusionExaggerationForZoom', () => {
  it('returns the stop values at the stops', () => {
    expect(extrusionExaggerationForZoom(4)).toBe(20);
    expect(extrusionExaggerationForZoom(6)).toBe(8);
    expect(extrusionExaggerationForZoom(8)).toBe(3);
    expect(extrusionExaggerationForZoom(10)).toBe(1.5);
    expect(extrusionExaggerationForZoom(12)).toBe(1);
  });

  it('interpolates linearly between stops', () => {
    expect(extrusionExaggerationForZoom(5)).toBe(14);
    expect(extrusionExaggerationForZoom(9)).toBe(2.25);
  });

  it('clamps outside the stop range', () => {
    expect(extrusionExaggerationForZoom(1)).toBe(20);
    expect(extrusionExaggerationForZoom(16)).toBe(1);
  });
});

describe('quantizeMapZoom', () => {
  it('rounds to the nearest quantum', () => {
    expect(quantizeMapZoom(8.74)).toBeCloseTo(8.7, 10);
    expect(quantizeMapZoom(8.75)).toBeCloseTo(8.8, 10);
    expect(quantizeMapZoom(4)).toBe(4);
  });

  it('exposes the quantum it rounds to', () => {
    expect(MAP_ZOOM_QUANTUM).toBe(0.1);
  });
});

describe('extrudedAltitudeMeters', () => {
  it('collapses ground-anchored references to zero', () => {
    expect(extrudedAltitudeMeters({ valueFt: 0, reference: 'SFC' }, 3)).toBe(0);
    expect(extrudedAltitudeMeters({ valueFt: 700, reference: 'AGL' }, 3)).toBe(0);
  });

  it('scales an MSL value through the feet-to-meters conversion and the multiplier', () => {
    expect(extrudedAltitudeMeters({ valueFt: 7000, reference: 'MSL' }, 3)).toBeCloseTo(
      7000 * FT_TO_METERS * 3,
      6,
    );
  });

  it('applies the cap before scaling', () => {
    expect(extrudedAltitudeMeters({ valueFt: 99999, reference: 'MSL' }, 2, CEILING_CAP_FT)).toBe(
      CEILING_CAP_FT * FT_TO_METERS * 2,
    );
  });

  it('treats a missing bound as ground level', () => {
    expect(extrudedAltitudeMeters(undefined, 3)).toBe(0);
  });
});

describe('buildExtrusionAltitudeExpression', () => {
  it('bakes the multiplier into a purely data-driven expression', () => {
    const expression = buildExtrusionAltitudeExpression('ref', 'ft', undefined, 3);
    expect(expression).toEqual([
      'match',
      ['get', 'ref'],
      ['SFC', 'AGL'],
      0,
      ['*', ['coalesce', ['get', 'ft'], 0], FT_TO_METERS * 3],
    ]);
    expect(JSON.stringify(expression)).not.toContain('zoom');
  });

  it('clamps the raw feet value when a cap is given', () => {
    const expression = buildExtrusionAltitudeExpression('ref', 'ft', CEILING_CAP_FT, 1);
    expect(expression[4]).toEqual([
      '*',
      ['min', ['coalesce', ['get', 'ft'], 0], CEILING_CAP_FT],
      FT_TO_METERS,
    ]);
  });
});
