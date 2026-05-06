import { describe, expect, it } from 'vitest';

import { isNavaidType, NAVAID_TYPES } from './navaid.js';

describe('NAVAID_TYPES / isNavaidType', () => {
  it('isNavaidType accepts every member of NAVAID_TYPES', () => {
    for (const member of NAVAID_TYPES) {
      expect(isNavaidType(member)).toBe(true);
    }
  });

  it('isNavaidType rejects strings outside the union', () => {
    const nonMembers = [
      '',
      'vor',
      'VOR ',
      'VOR-DME',
      'GPS',
      'WAAS',
      'FAN MARKER',
      'MARINE NDB',
      'unknown',
    ];
    for (const value of nonMembers) {
      expect(isNavaidType(value)).toBe(false);
    }
  });

  it('NAVAID_TYPES contains no duplicates', () => {
    expect(new Set(NAVAID_TYPES).size).toBe(NAVAID_TYPES.length);
  });
});
