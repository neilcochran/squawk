import { describe, expect, it } from 'vitest';

import { AIRSPACE_TYPES, ARTCC_STRATA, isAirspaceType, isArtccStratum } from './airspace.js';

describe('AIRSPACE_TYPES / isAirspaceType', () => {
  it('isAirspaceType accepts every member of AIRSPACE_TYPES', () => {
    for (const member of AIRSPACE_TYPES) {
      expect(isAirspaceType(member)).toBe(true);
    }
  });

  it('isAirspaceType rejects strings outside the union', () => {
    const nonMembers = [
      '',
      'class_b',
      'CLASS_A',
      'CLASS_E1',
      'CLASS_E8',
      'TFR',
      'CLASS_B ',
      'unknown',
    ];
    for (const value of nonMembers) {
      expect(isAirspaceType(value)).toBe(false);
    }
  });

  it('AIRSPACE_TYPES contains no duplicates', () => {
    expect(new Set(AIRSPACE_TYPES).size).toBe(AIRSPACE_TYPES.length);
  });
});

describe('ARTCC_STRATA / isArtccStratum', () => {
  it('isArtccStratum accepts every member of ARTCC_STRATA', () => {
    for (const member of ARTCC_STRATA) {
      expect(isArtccStratum(member)).toBe(true);
    }
  });

  it('isArtccStratum rejects strings outside the union', () => {
    const nonMembers = ['', 'low', 'HIGH ', 'CTA-FIR', 'OCEANIC', 'UTA/CTA'];
    for (const value of nonMembers) {
      expect(isArtccStratum(value)).toBe(false);
    }
  });

  it('ARTCC_STRATA contains no duplicates', () => {
    expect(new Set(ARTCC_STRATA).size).toBe(ARTCC_STRATA.length);
  });
});
