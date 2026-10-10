import { describe, expect, it } from 'vitest';

import type { AirspaceFeature, ArtccStratum } from '@squawk/types';

import { CLASS_A_NAME, deriveClassA, isClassASource } from './derive-class-a.js';

function artcc(identifier: string, stratum: ArtccStratum, lon = 0): AirspaceFeature {
  return {
    type: 'ARTCC',
    name: identifier,
    identifier,
    floor: { valueFt: 0, reference: 'SFC' },
    ceiling: { valueFt: 99999, reference: 'MSL' },
    boundary: {
      type: 'Polygon',
      coordinates: [
        [
          [lon, 40],
          [lon + 1, 40],
          [lon + 1, 41],
          [lon, 41],
          [lon, 40],
        ],
      ],
    },
    state: null,
    controllingFacility: null,
    scheduleDescription: null,
    artccStratum: stratum,
  };
}

describe('isClassASource', () => {
  it('accepts every HIGH stratum', () => {
    expect(isClassASource(artcc('ZBW', 'HIGH'))).toBe(true);
    expect(isClassASource(artcc('ZAN', 'HIGH'))).toBe(true);
  });

  it('accepts the combined stratum of San Juan, which NASR publishes without a HIGH', () => {
    expect(isClassASource(artcc('ZSU', 'CTA/FIR'))).toBe(true);
  });

  it('rejects the other strata, including the oceanic and Honolulu ones', () => {
    for (const stratum of ['LOW', 'UTA', 'CTA', 'FIR'] as const) {
      expect(isClassASource(artcc('ZBW', stratum))).toBe(false);
    }
    expect(isClassASource(artcc('ZHN', 'CTA/FIR'))).toBe(false);
    expect(isClassASource(artcc('ZAK', 'CTA/FIR'))).toBe(false);
  });

  it('rejects anything that is not an ARTCC feature', () => {
    expect(isClassASource({ ...artcc('ZBW', 'HIGH'), type: 'CLASS_B' })).toBe(false);
  });
});

describe('deriveClassA', () => {
  it('emits one Class A feature per qualifying shape, with the Class A block over the source polygon', () => {
    const high = artcc('ZBW', 'HIGH', -72);
    const sanJuan = artcc('ZSU', 'CTA/FIR', -66);

    const derived = deriveClassA([
      artcc('ZBW', 'LOW', -72),
      high,
      artcc('ZHN', 'CTA/FIR', -158),
      sanJuan,
    ]);

    expect(derived).toEqual([
      {
        type: 'CLASS_A',
        name: CLASS_A_NAME,
        identifier: '',
        floor: { valueFt: 18000, reference: 'MSL' },
        ceiling: { valueFt: 60000, reference: 'MSL' },
        boundary: high.boundary,
        state: null,
        controllingFacility: null,
        scheduleDescription: null,
        artccStratum: null,
      },
      expect.objectContaining({ type: 'CLASS_A', boundary: sanJuan.boundary }),
    ]);
  });

  it('keeps every shape of a center whose HIGH stratum was split into several', () => {
    const derived = deriveClassA([artcc('ZAN', 'HIGH', -170), artcc('ZAN', 'HIGH', 175)]);

    expect(derived).toHaveLength(2);
    expect(derived.map((feature) => feature.boundary.coordinates[0]?.[0]?.[0])).toEqual([
      -170, 175,
    ]);
  });

  it('derives nothing from a corpus with no qualifying stratum', () => {
    expect(deriveClassA([artcc('ZAK', 'FIR'), artcc('ZBW', 'LOW')])).toEqual([]);
    expect(deriveClassA([])).toEqual([]);
  });
});
