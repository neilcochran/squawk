import { describe, expect, it } from 'vitest';

import type { AirspaceType } from '@squawk/types';

import {
  AIRSPACE_CEILING_FT_PROPERTY,
  AIRSPACE_CEILING_REF_PROPERTY,
  AIRSPACE_FLOOR_FT_PROPERTY,
  AIRSPACE_FLOOR_REF_PROPERTY,
} from '../../../shared/inspector/airspace-feature.ts';

import {
  AIRSPACE_TYPE_DEPTH_ORDER,
  CEILING_CAP_FT,
  CEILING_DEPTH_BIAS_METERS_PER_RANK,
  FT_TO_METERS,
  MAP_ZOOM_QUANTUM,
  buildExtrusionAltitudeExpression,
  buildExtrusionBaseExpression,
  buildExtrusionHeightExpression,
  depthRankOfAirspaceType,
  extrudedAltitudeMeters,
  extrusionCeilingMeters,
  extrusionExaggerationForZoom,
  quantizeMapZoom,
} from './airspace-extrusion-scale.ts';

/**
 * Every airspace type, as a record so the compiler fails this spec when
 * a type is added to the union without a decision about its depth rank.
 */
const EVERY_AIRSPACE_TYPE: Record<AirspaceType, true> = {
  CLASS_A: true,
  CLASS_B: true,
  CLASS_C: true,
  CLASS_D: true,
  CLASS_E2: true,
  CLASS_E3: true,
  CLASS_E4: true,
  CLASS_E5: true,
  CLASS_E6: true,
  CLASS_E7: true,
  MOA: true,
  RESTRICTED: true,
  PROHIBITED: true,
  WARNING: true,
  ALERT: true,
  NSA: true,
  ARTCC: true,
};

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

describe('depthRankOfAirspaceType', () => {
  it('ranks every airspace type exactly once', () => {
    const listed = AIRSPACE_TYPE_DEPTH_ORDER.flat();
    expect([...listed].sort()).toEqual(Object.keys(EVERY_AIRSPACE_TYPE).sort());
    expect(new Set(listed).size).toBe(listed.length);
  });

  it('ranks blanket classes below terminal classes and those below special-use areas', () => {
    expect(depthRankOfAirspaceType('ARTCC')).toBeLessThan(depthRankOfAirspaceType('CLASS_A'));
    expect(depthRankOfAirspaceType('CLASS_A')).toBeLessThan(depthRankOfAirspaceType('CLASS_E5'));
    expect(depthRankOfAirspaceType('CLASS_E5')).toBeLessThan(depthRankOfAirspaceType('CLASS_D'));
    expect(depthRankOfAirspaceType('CLASS_D')).toBeLessThan(depthRankOfAirspaceType('CLASS_C'));
    expect(depthRankOfAirspaceType('CLASS_C')).toBeLessThan(depthRankOfAirspaceType('CLASS_B'));
    expect(depthRankOfAirspaceType('CLASS_B')).toBeLessThan(depthRankOfAirspaceType('MOA'));
    expect(depthRankOfAirspaceType('MOA')).toBe(depthRankOfAirspaceType('RESTRICTED'));
  });

  it('ranks an unknown or missing type lowest', () => {
    expect(depthRankOfAirspaceType('SOMETHING_NEW')).toBe(0);
    expect(depthRankOfAirspaceType(undefined)).toBe(0);
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

describe('extrusionCeilingMeters', () => {
  it('adds the type depth lift to the capped, exaggerated ceiling', () => {
    const rank = depthRankOfAirspaceType('MOA');
    expect(extrusionCeilingMeters({ valueFt: 18000, reference: 'MSL' }, 'MOA', 3)).toBeCloseTo(
      18000 * FT_TO_METERS * 3 + rank * CEILING_DEPTH_BIAS_METERS_PER_RANK * 3,
      6,
    );
  });

  it('lifts a more specific type above a blanket one that ends at the same altitude', () => {
    const ceiling = { valueFt: 60000, reference: 'MSL' as const };
    expect(extrusionCeilingMeters(ceiling, 'WARNING', 8)).toBeGreaterThan(
      extrusionCeilingMeters(ceiling, 'CLASS_A', 8),
    );
  });

  it('keeps a ground-anchored or missing ceiling at zero with no lift', () => {
    expect(extrusionCeilingMeters({ valueFt: 1000, reference: 'AGL' }, 'PROHIBITED', 3)).toBe(0);
    expect(extrusionCeilingMeters(undefined, 'MOA', 3)).toBe(0);
  });
});

describe('buildExtrusionAltitudeExpression', () => {
  it('bakes the multiplier into a purely data-driven expression', () => {
    const expression = buildExtrusionAltitudeExpression('ref', 'ft', undefined, 3, 0);
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
    const expression = buildExtrusionAltitudeExpression('ref', 'ft', CEILING_CAP_FT, 1, 0);
    expect(expression[4]).toEqual([
      '*',
      ['min', ['coalesce', ['get', 'ft'], 0], CEILING_CAP_FT],
      FT_TO_METERS,
    ]);
  });

  it('adds a per-type lift inside the MSL branch when a bias is given', () => {
    const expression = buildExtrusionAltitudeExpression('ref', 'ft', undefined, 2, 10);
    expect(expression[4]).toEqual([
      '+',
      ['*', ['coalesce', ['get', 'ft'], 0], FT_TO_METERS * 2],
      [
        'match',
        ['get', 'type'],
        ['ARTCC'],
        0,
        ['CLASS_A'],
        10,
        ['CLASS_E2', 'CLASS_E3', 'CLASS_E4', 'CLASS_E5', 'CLASS_E6', 'CLASS_E7'],
        20,
        ['CLASS_D'],
        30,
        ['CLASS_C'],
        40,
        ['CLASS_B'],
        50,
        ['MOA', 'RESTRICTED', 'PROHIBITED', 'WARNING', 'ALERT', 'NSA'],
        60,
        0,
      ],
    ]);
  });
});

describe('buildExtrusionBaseExpression', () => {
  it('reads the floor primitives with no cap and no lift', () => {
    expect(buildExtrusionBaseExpression(3)).toEqual(
      buildExtrusionAltitudeExpression(
        AIRSPACE_FLOOR_REF_PROPERTY,
        AIRSPACE_FLOOR_FT_PROPERTY,
        undefined,
        3,
        0,
      ),
    );
  });
});

describe('buildExtrusionHeightExpression', () => {
  it('reads the ceiling primitives with the cap and the exaggerated depth lift', () => {
    expect(buildExtrusionHeightExpression(3)).toEqual(
      buildExtrusionAltitudeExpression(
        AIRSPACE_CEILING_REF_PROPERTY,
        AIRSPACE_CEILING_FT_PROPERTY,
        CEILING_CAP_FT,
        3,
        CEILING_DEPTH_BIAS_METERS_PER_RANK * 3,
      ),
    );
  });
});
