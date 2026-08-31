import { describe, it, expect } from 'vitest';

import { decodeModeAc } from './mode-ac.js';

function bytesFor(modeA: number): Uint8Array {
  return Uint8Array.of((modeA >> 8) & 0xff, modeA & 0xff);
}

describe('decodeModeAc - squawk decode', () => {
  it.each([
    ['1200 (standard US VFR)', 0x1200, '1200'],
    ['7500 (hijack)', 0x7500, '7500'],
    ['7600 (comm failure)', 0x7600, '7600'],
    ['7700 (emergency)', 0x7700, '7700'],
    ['0000', 0x0000, '0000'],
  ])('decodes squawk %s', (_label, modeA, expected) => {
    expect(decodeModeAc(bytesFor(modeA)).squawk).toBe(expected);
  });

  it('masks out non-digit bits when extracting the squawk code', () => {
    // Set the Ident (0x0080) and a spare bit (0x0008) alongside a valid squawk
    const result = decodeModeAc(bytesFor(0x1200 | 0x0080 | 0x0008));
    expect(result.squawk).toBe('1200');
  });
});

describe('decodeModeAc - ident flag', () => {
  it('reports identActive true when the SPI pulse bit is set', () => {
    expect(decodeModeAc(bytesFor(0x1200 | 0x0080)).identActive).toBe(true);
  });

  it('reports identActive false when the SPI pulse bit is unset', () => {
    expect(decodeModeAc(bytesFor(0x1200)).identActive).toBe(false);
  });
});

describe('decodeModeAc - altitude decode', () => {
  it('decodes a valid Mode C altitude report', () => {
    // Verified by exhaustive cross-check against dump1090-fa's reference
    // algorithm (see mode-ac.ts) - 0x4220 is a known-valid code decoding
    // to 5000 ft.
    const result = decodeModeAc(bytesFor(0x4220));
    expect(result.altitudeFt).toBe(5000);
  });

  it('leaves altitudeFt undefined when Ident is active, even over an otherwise-valid code', () => {
    const result = decodeModeAc(bytesFor(0x4220 | 0x0080));
    expect(result.altitudeFt).toBeUndefined();
    expect(result.identActive).toBe(true);
  });

  it('leaves altitudeFt undefined when the C1/C2/C4 digit is entirely zero', () => {
    // A code with the C-nibble (bits 4-6) all zero is not a valid altitude report.
    const result = decodeModeAc(bytesFor(0x1000));
    expect(result.altitudeFt).toBeUndefined();
  });

  it('leaves altitudeFt undefined when the D1 pulse is set (illegal for altitude)', () => {
    const result = decodeModeAc(bytesFor(0x4220 | 0x0001));
    expect(result.altitudeFt).toBeUndefined();
  });

  it('leaves altitudeFt undefined for a pure identity code with no altitude information', () => {
    const result = decodeModeAc(bytesFor(0x1200));
    expect(result.altitudeFt).toBeUndefined();
  });

  // Each case below was found by exhaustively searching all 65536 possible
  // codes for one that sets a specific pulse bit while remaining a valid
  // Mode C report (see mode-ac.ts's TSDoc on the exhaustive cross-check
  // this algorithm was verified against) - not physically realistic
  // altitudes, just isolated coverage of each unscrambling branch,
  // correctness already established by that exhaustive comparison.
  it.each([
    ['C1 pulse (also exercises the 7->5 remap)', 0x0010, -800],
    ['C4 pulse', 0x0040, -1200],
    ['D2 pulse (also exercises the fiveHundreds-odd correction)', 0x0012, 126300],
    ['D4 pulse', 0x0014, 62300],
    ['A1 pulse', 0x1010, 30300],
    ['A4 pulse', 0x4010, 6300],
    ['B1 pulse', 0x0110, 2300],
    ['B4 pulse', 0x0410, -700],
  ])('decodes a valid code exercising the %s', (_label, modeA, expectedFt) => {
    expect(decodeModeAc(bytesFor(modeA)).altitudeFt).toBe(expectedFt);
  });
});
