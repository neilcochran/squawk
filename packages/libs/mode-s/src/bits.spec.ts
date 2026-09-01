import { describe, it, expect } from 'vitest';

import { bitAt, extractBits } from './bits.js';

describe('extractBits', () => {
  it('extracts a single bit at various offsets', () => {
    const bytes = Uint8Array.of(0b10110010, 0b01000001);
    expect(extractBits(bytes, 0, 1)).toBe(1);
    expect(extractBits(bytes, 1, 1)).toBe(0);
    expect(extractBits(bytes, 7, 1)).toBe(0);
    expect(extractBits(bytes, 8, 1)).toBe(0);
    expect(extractBits(bytes, 9, 1)).toBe(1);
    expect(extractBits(bytes, 15, 1)).toBe(1);
  });

  it('extracts a multi-bit field within a single byte', () => {
    const bytes = Uint8Array.of(0b10110010);
    expect(extractBits(bytes, 0, 5)).toBe(0b10110); // top 5 bits
    expect(extractBits(bytes, 5, 3)).toBe(0b010); // bottom 3 bits
  });

  it('extracts a field spanning a byte boundary', () => {
    // bits 4-11 (8 bits) span the low nibble of byte 0 and the high nibble of byte 1
    const bytes = Uint8Array.of(0b00001111, 0b11110000);
    expect(extractBits(bytes, 4, 8)).toBe(0xff);
  });

  it('extracts a field spanning three bytes, matching the 17-bit CPR field layout', () => {
    // Mirrors the real ADS-B airborne position ME field: CPR latitude is
    // bits 22-38 (17 bits) of the 56-bit ME payload. Bits 22-38 are set to
    // all 1s here (byte2=0x03, byte3=0xff, byte4=0xfe), everything else 0.
    const bytes = Uint8Array.of(0x00, 0x00, 0x03, 0xff, 0xfe, 0x00);
    expect(extractBits(bytes, 22, 17)).toBe(0x1ffff);
  });

  it('returns 0 for bits past the end of the array rather than throwing', () => {
    const bytes = Uint8Array.of(0xff);
    expect(extractBits(bytes, 8, 8)).toBe(0);
    expect(extractBits(bytes, 4, 8)).toBe(0xf0);
  });

  it('returns 0 for a zero-length extraction', () => {
    const bytes = Uint8Array.of(0xff);
    expect(extractBits(bytes, 0, 0)).toBe(0);
  });
});

// Cross-checks extractBits against the CPR fields already hand-verified in
// cpr.spec.ts's real-capture block (same message, same raw values) - two
// independent derivations of the same real data should agree exactly.
describe('bitAt', () => {
  it('reads each bit of a 13-bit field, MSB first', () => {
    // 0b1000000000001 - only the MSB (position 0) and LSB (position 12) set
    const value = 0b1000000000001;
    expect(bitAt(value, 0, 13)).toBe(1);
    expect(bitAt(value, 1, 13)).toBe(0);
    expect(bitAt(value, 12, 13)).toBe(1);
  });

  it('agrees with extractBits on the same field, read as a byte array', () => {
    const value = 0b1011010010110; // arbitrary 13-bit pattern
    const bytes = Uint8Array.of((value >> 8) & 0xff, value & 0xff);
    for (let pos = 0; pos < 13; pos++) {
      expect(bitAt(value, pos, 13)).toBe(extractBits(bytes, 3 + pos, 1));
    }
  });
});

describe('extractBits - real dump1090-fa Beast capture cross-check', () => {
  it('reproduces the hand-derived CPR format bit and lat/lon fields from a real DF17 position message', () => {
    const me = Uint8Array.of(0x58, 0xc9, 0x01, 0x06, 0xe9, 0x19, 0x9e); // ME field only
    expect(extractBits(me, 21, 1)).toBe(0); // F bit - this was the even frame
    expect(extractBits(me, 22, 17)).toBe(33652); // CPR latitude
    expect(extractBits(me, 39, 17)).toBe(72094); // CPR longitude
  });
});
