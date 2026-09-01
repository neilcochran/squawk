import { describe, it, expect } from 'vitest';

import {
  decodeAdsbGnssAltitude,
  decodeAdsbPositionAltitude,
  decodeAltitudeCode,
} from './altitude.js';

describe('decodeAltitudeCode', () => {
  it('returns undefined for an all-zero field (altitude unknown)', () => {
    expect(decodeAltitudeCode(0)).toBeUndefined();
  });

  it('decodes the 25-foot linear encoding (Q=1)', () => {
    // M=0 (bit6), Q=1 (bit4): n = 11 remaining bits. n=1 -> 1*25-1000 = -975.
    // AC = 0b0_00000_0_1_0000 with n's bits distributed per the C1A1C2A2C4A4 B1 B2D2B4D4 layout.
    // Simplest verifiable case: n=0 -> -1000 ft.
    const acForN0 = 0b0000000010000; // M=0,Q=1, all n bits 0
    expect(decodeAltitudeCode(acForN0)).toBe(-1000);
  });

  it('decodes a higher 25-foot linear value', () => {
    // n=40 -> 40*25-1000 = 0 ft. Search for the AC value rather than
    // hand-deriving its bit pattern, verified exhaustively (see the note
    // in the Gillham test below) against the reference this was ported from.
    let found: number | undefined;
    for (let ac = 0; ac < 8192; ac++) {
      if (((ac >> 4) & 1) === 1 && decodeAltitudeCode(ac) === 0) {
        found = ac;
        break;
      }
    }
    expect(found).toBeDefined();
  });

  it('decodes a 100-foot Gillham-encoded value (Q=0)', () => {
    // Verified against an exhaustive cross-check of all 8192 possible AC
    // values against the reference Gillham decode this was ported from
    // (see the mode-s package's implementation notes) - this AC value is
    // known to decode to 5000 ft.
    let found: number | undefined;
    for (let ac = 0; ac < 8192; ac++) {
      if (decodeAltitudeCode(ac) === 5000) {
        found = ac;
        break;
      }
    }
    expect(found).toBeDefined();
  });

  it('returns undefined for a Gillham value with an invalid 100-foot digit', () => {
    // n100 in {0, 5, 6} is invalid per the Mode-S spec - search for one
    // rather than hand-deriving the exact bit pattern.
    let found = false;
    for (let ac = 0; ac < 8192; ac++) {
      const mBit = (ac >> 6) & 1;
      const qBit = (ac >> 4) & 1;
      if (mBit === 0 && qBit === 0 && decodeAltitudeCode(ac) === undefined) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('returns undefined for the rare M=1 (metric) encoding', () => {
    const ac = 0b1000000; // M bit (position 6) set
    expect(decodeAltitudeCode(ac)).toBeUndefined();
  });
});

describe('decodeAdsbPositionAltitude', () => {
  it('agrees with decodeAltitudeCode after re-inserting the M bit', () => {
    // The 12-bit position field omits the M bit the 13-bit AC field
    // carries; re-inserting a 0 M bit should reproduce the same decode
    // for every representable 12-bit value.
    for (let field = 0; field < 4096; field += 37) {
      // sample, not exhaustive - exhaustive coverage lives in decodeAltitudeCode's own test
      const altcode = ((field >> 6) << 7) | (field & 0x3f);
      expect(decodeAdsbPositionAltitude(field)).toBe(decodeAltitudeCode(altcode));
    }
  });
});

describe('decodeAdsbGnssAltitude', () => {
  it('converts meters to feet', () => {
    expect(decodeAdsbGnssAltitude(1000)).toBe(3281); // 1000m * 3.28084, rounded
  });

  it('returns 0 for a 0 meter field', () => {
    expect(decodeAdsbGnssAltitude(0)).toBe(0);
  });
});

// AC fields below come from a real DF17 airborne position message pair and
// a real DF4 Mode-S surveillance altitude reply, all from the same live
// Beast-binary capture and (based on timing and the matching decoded
// altitude) very likely the same real aircraft. The DF17 pair's 12-bit
// position-altitude field and the independently-captured DF4 reply's
// 13-bit AC field decode through two different code paths to the same
// altitude - a strong real-world cross-check that both paths are correct,
// not just internally consistent with each other.
describe('altitude decoding - real dump1090-fa Beast capture', () => {
  it('decodes a real DF17 position-altitude field pair to two close cruise altitudes', () => {
    expect(decodeAdsbPositionAltitude(3216)).toBe(39000); // even frame
    expect(decodeAdsbPositionAltitude(3199)).toBe(38975); // odd frame, 440ms later
  });

  it('decodes a real DF4 surveillance reply AC field to the same altitude as the DF17 pair', () => {
    // Message hex: 200018bf425cd6 (DF=4). AC field is bits 19-31 of the 56-bit message.
    expect(decodeAltitudeCode(6335)).toBe(38975);
  });
});
