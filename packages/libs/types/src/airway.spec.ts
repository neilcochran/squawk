import { describe, expect, it } from 'vitest';

import { AIRWAY_TYPES, isAirwayType } from './airway.js';

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
});
