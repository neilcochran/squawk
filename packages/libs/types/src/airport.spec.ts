import { describe, expect, it } from 'vitest';

import { FACILITY_TYPES, isFacilityType } from './airport.js';

describe('FACILITY_TYPES / isFacilityType', () => {
  it('isFacilityType accepts every member of FACILITY_TYPES', () => {
    for (const member of FACILITY_TYPES) {
      expect(isFacilityType(member)).toBe(true);
    }
  });

  it('isFacilityType rejects strings outside the union', () => {
    const nonMembers = ['', 'airport', 'AIRPORT ', 'TOWER', 'SEAPLANE', 'A', 'unknown'];
    for (const value of nonMembers) {
      expect(isFacilityType(value)).toBe(false);
    }
  });

  it('FACILITY_TYPES contains no duplicates', () => {
    expect(new Set(FACILITY_TYPES).size).toBe(FACILITY_TYPES.length);
  });
});
