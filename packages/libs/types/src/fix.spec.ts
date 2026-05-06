import { describe, expect, it } from 'vitest';

import { FIX_USE_CODES, isFixUseCode } from './fix.js';

describe('FIX_USE_CODES / isFixUseCode', () => {
  it('isFixUseCode accepts every member of FIX_USE_CODES', () => {
    for (const member of FIX_USE_CODES) {
      expect(isFixUseCode(member)).toBe(true);
    }
  });

  it('isFixUseCode rejects strings outside the union', () => {
    const nonMembers = ['', 'wp', 'WP ', 'XX', 'WAYPOINT', 'FIX', 'unknown'];
    for (const value of nonMembers) {
      expect(isFixUseCode(value)).toBe(false);
    }
  });

  it('FIX_USE_CODES contains no duplicates', () => {
    expect(new Set(FIX_USE_CODES).size).toBe(FIX_USE_CODES.length);
  });
});
