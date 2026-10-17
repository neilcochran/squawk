import type { Polygon } from 'geojson';
import { describe, it, expect } from 'vitest';

import type { AirspaceFeature, AirspaceVolume } from '@squawk/types';

import {
  AIRSPACE_EXCLUSION_FILL_LAYER_ID,
  AIRSPACE_EXCLUSION_FOCUS_LAYER_ID,
  AIRSPACE_EXCLUSION_KEY_PROPERTY,
  AIRSPACE_EXCLUSION_LINE_LAYER_ID,
  toExclusionCollection,
} from './airspace-exclusion-features.ts';

const SQUARE: Polygon = {
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

function buildVolume(boundary: Polygon = SQUARE): AirspaceVolume {
  return {
    floor: { valueFt: 0, reference: 'SFC' },
    ceiling: { valueFt: 1500, reference: 'AGL' },
    boundary,
  };
}

function buildFeature(exclusions?: AirspaceVolume[]): AirspaceFeature {
  return {
    type: 'MOA',
    name: 'TEST MOA',
    identifier: 'MTEST',
    floor: { valueFt: 500, reference: 'AGL' },
    ceiling: { valueFt: 18000, reference: 'MSL' },
    boundary: SQUARE,
    state: null,
    controllingFacility: null,
    scheduleDescription: null,
    artccStratum: null,
    ...(exclusions !== undefined && { exclusions }),
  };
}

describe('toExclusionCollection', () => {
  it('keys each excluded footprint by its feature and exclusion position', () => {
    const second: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [5, 5],
          [6, 5],
          [6, 6],
          [5, 5],
        ],
      ],
    };
    const fc = toExclusionCollection([
      buildFeature(),
      buildFeature([buildVolume(), buildVolume(second)]),
    ]);
    expect(
      fc.features.map((feature) => feature.properties[AIRSPACE_EXCLUSION_KEY_PROPERTY]),
    ).toEqual(['1:0', '1:1']);
    expect(fc.features[1]?.geometry).toBe(second);
  });

  it('returns an empty collection when no feature has exclusions', () => {
    expect(toExclusionCollection([buildFeature(), buildFeature([])]).features).toEqual([]);
  });
});

describe('exclusion layer ids', () => {
  it('are stable atlas-prefixed ids', () => {
    expect(AIRSPACE_EXCLUSION_FILL_LAYER_ID).toBe('atlas-airspace-exclusion-fill');
    expect(AIRSPACE_EXCLUSION_LINE_LAYER_ID).toBe('atlas-airspace-exclusion-line');
    expect(AIRSPACE_EXCLUSION_FOCUS_LAYER_ID).toBe('atlas-airspace-exclusion-focus');
  });
});
