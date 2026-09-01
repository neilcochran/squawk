import { describe, it, expect } from 'vitest';

import { decodeIdentityCode } from './identity.js';

describe('decodeIdentityCode', () => {
  it('decodes 0x0808 to 1200 (matches the reference this was ported from)', () => {
    expect(decodeIdentityCode(0x0808)).toBe('1200');
  });

  it('decodes an all-zero field to 0000', () => {
    expect(decodeIdentityCode(0)).toBe('0000');
  });

  it('decodes 7700 (emergency)', () => {
    // A4A2A1=111(7), B4B2B1=111(7), C4C2C1=000(0), D4D2D1=000(0)
    // bit positions (MSB-first): A1=1,A2=3,A4=5, B1=7,B2=9,B4=11
    const bits = [1, 3, 5, 7, 9, 11];
    let idField = 0;
    for (const pos of bits) {
      idField |= 1 << (12 - pos);
    }
    expect(decodeIdentityCode(idField)).toBe('7700');
  });

  it('decodes each digit independently', () => {
    // D4D2D1 only (bits 12,10,8) -> D=7, rest 0
    const dOnly = (1 << (12 - 12)) | (1 << (12 - 10)) | (1 << (12 - 8));
    expect(decodeIdentityCode(dOnly)).toBe('0007');
    // C4C2C1 only (bits 4,2,0) -> C=7
    const cOnly = (1 << (12 - 4)) | (1 << (12 - 2)) | (1 << (12 - 0));
    expect(decodeIdentityCode(cOnly)).toBe('0070');
  });
});

// idField extracted from a real DF5 Mode-S surveillance identity reply in
// a live Beast-binary capture off a real dump1090-fa station (message hex
// 28001d022de23c) - not synthetic.
describe('decodeIdentityCode - real dump1090-fa Beast capture', () => {
  it('decodes a real DF5 identity reply to a plausible squawk code', () => {
    expect(decodeIdentityCode(7426)).toBe('1470');
  });
});
