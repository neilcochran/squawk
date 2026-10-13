import { describe, expect, it } from 'vitest';

import {
  AIRWAY_DIRECTIONS,
  AIRWAY_TYPES,
  ATS_TYPE_MAP,
  isAirwayDirection,
  isAirwayType,
} from './airway.js';

describe('AIRWAY_TYPES / isAirwayType', () => {
  it('isAirwayType accepts every member of AIRWAY_TYPES', () => {
    for (const member of AIRWAY_TYPES) {
      expect(isAirwayType(member)).toBe(true);
    }
  });

  it('isAirwayType rejects strings outside the union', () => {
    const nonMembers = ['', 'victor', 'V', 'J', 'Q', 'JET ', 'PUERTORICO', 'OCEANIC', 'unknown'];
    for (const value of nonMembers) {
      expect(isAirwayType(value)).toBe(false);
    }
  });

  it('AIRWAY_TYPES contains no duplicates', () => {
    expect(new Set(AIRWAY_TYPES).size).toBe(AIRWAY_TYPES.length);
  });

  it('maps every ATS route category, including the special routes, to a type', () => {
    expect(Object.keys(ATS_TYPE_MAP).sort()).toEqual(['AT', 'BF', 'PA', 'PR', 'SP']);
    expect(ATS_TYPE_MAP['SP']).toBe('SPECIAL');
  });
});

describe('AIRWAY_DIRECTIONS / isAirwayDirection', () => {
  it('isAirwayDirection accepts every member of AIRWAY_DIRECTIONS', () => {
    for (const member of AIRWAY_DIRECTIONS) {
      expect(isAirwayDirection(member)).toBe(true);
    }
  });

  it('isAirwayDirection rejects the bare BND template and other strings', () => {
    const nonMembers = ['', 'BND', 'E', 'EBND', 'E BND ', 'e bnd', 'NNE BND', 'EAST BND'];
    for (const value of nonMembers) {
      expect(isAirwayDirection(value)).toBe(false);
    }
  });

  it('AIRWAY_DIRECTIONS lists the eight compass directions once each', () => {
    expect(AIRWAY_DIRECTIONS).toHaveLength(8);
    expect(new Set(AIRWAY_DIRECTIONS).size).toBe(8);
  });
});
