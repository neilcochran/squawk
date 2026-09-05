import { describe, it, expect } from 'vitest';

import { decodeFlightStatus } from './flight-status.js';

describe('decodeFlightStatus', () => {
  it.each([
    [0, false, false],
    [1, false, false],
    [2, false, true],
    [3, false, true],
    [4, true, true],
    [5, true, false],
  ] as const)('decodes FS %i to identActive=%s, squawkAlert=%s', (fs, identActive, squawkAlert) => {
    expect(decodeFlightStatus(fs)).toEqual({ identActive, squawkAlert });
  });

  it.each([6, 7])('reports both fields as undefined for the reserved FS value %i', (reserved) => {
    expect(decodeFlightStatus(reserved)).toEqual({
      identActive: undefined,
      squawkAlert: undefined,
    });
  });

  it('falls back to reserved for an out-of-range value (the field is 3 bits, 0-7, but the type cannot express that)', () => {
    expect(decodeFlightStatus(8)).toEqual({ identActive: undefined, squawkAlert: undefined });
  });
});
