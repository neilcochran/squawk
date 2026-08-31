import { describe, it, expect } from 'vitest';

import { decodeEmergencyState } from './emergency-status.js';

describe('decodeEmergencyState', () => {
  it.each([
    [0, 'none'],
    [1, 'general'],
    [2, 'lifeguardMedical'],
    [3, 'minimumFuel'],
    [4, 'noCommunications'],
    [5, 'unlawfulInterference'],
    [6, 'downed'],
    [7, 'reserved'],
  ] as const)('decodes raw state %i to %s', (raw, expected) => {
    expect(decodeEmergencyState(raw)).toBe(expected);
  });

  it('falls back to reserved for an out-of-range value (the field is 3 bits, 0-7, but the type cannot express that)', () => {
    expect(decodeEmergencyState(8)).toBe('reserved');
  });
});
