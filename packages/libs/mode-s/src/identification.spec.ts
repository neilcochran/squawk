import { describe, it, expect } from 'vitest';

import { decodeIdentification } from './identification.js';
import { setBits } from './test-utils.js';

/** 6-bit code for a callsign character, per the ICAO Mode-S alphabet: 1-26 = A-Z, 32 = space, 48-57 = 0-9. */
function charCode(ch: string): number {
  if (ch === ' ') {
    return 32;
  }
  if (ch >= '0' && ch <= '9') {
    return ch.charCodeAt(0);
  }
  return ch.charCodeAt(0) & 0x3f; // 'A'-'Z' (0x41-0x5A) masked to 1-26
}

function buildIdentificationMe(typeCode: number, category: number, callsign: string): Uint8Array {
  const me = new Uint8Array(7);
  setBits(me, 0, 5, typeCode);
  setBits(me, 5, 3, category);
  const padded = callsign.padEnd(8, ' ').slice(0, 8);
  for (let i = 0; i < 8; i++) {
    setBits(me, 8 + i * 6, 6, charCode(padded[i] ?? ' '));
  }
  return me;
}

describe('decodeIdentification', () => {
  it('decodes a callsign and heavy category from a type-4 message', () => {
    const me = buildIdentificationMe(4, 5, 'UAL123');
    const result = decodeIdentification(me);
    expect(result.callsign).toBe('UAL123');
    expect(result.category).toBe('heavy');
  });

  it('decodes categories from each type-code set (A/B/C)', () => {
    expect(decodeIdentification(buildIdentificationMe(4, 7, 'N1')).category).toBe('rotorcraft'); // A7
    expect(decodeIdentification(buildIdentificationMe(3, 1, 'N2')).category).toBe('glider'); // B1
    expect(decodeIdentification(buildIdentificationMe(2, 1, 'N3')).category).toBe(
      'surfaceEmergencyVehicle',
    ); // C1
  });

  it('leaves category undefined when the category subfield is 0 (no info)', () => {
    expect(decodeIdentification(buildIdentificationMe(4, 0, 'UAL123')).category).toBeUndefined();
  });

  it('leaves category undefined for type code 1 (unassigned set)', () => {
    expect(decodeIdentification(buildIdentificationMe(1, 3, 'UAL123')).category).toBeUndefined();
  });

  it('leaves category undefined for a reserved (tc, category) combination', () => {
    // B5 and C6 have no entry in squawk's AircraftCategory
    expect(decodeIdentification(buildIdentificationMe(3, 5, 'N1')).category).toBeUndefined();
    expect(decodeIdentification(buildIdentificationMe(2, 6, 'N1')).category).toBeUndefined();
  });

  it('trims trailing spaces from a shorter callsign', () => {
    expect(decodeIdentification(buildIdentificationMe(4, 5, 'N1')).callsign).toBe('N1');
  });

  it('returns undefined callsign for an entirely blank field', () => {
    expect(decodeIdentification(buildIdentificationMe(4, 5, '')).callsign).toBeUndefined();
  });

  it('decodes digits within a callsign', () => {
    expect(decodeIdentification(buildIdentificationMe(4, 5, 'N738MA')).callsign).toBe('N738MA');
  });

  it('renders an invalid 6-bit character as # rather than dropping it', () => {
    const me = buildIdentificationMe(4, 5, 'N1');
    setBits(me, 8, 6, 63); // 63 is not in the valid alphabet (only 1-26, 32, 48-57 are) - overrides the leading 'N'
    expect(decodeIdentification(me).callsign).toBe('#1');
  });
});

// ME fields below are the 7-byte ME payload of real DF17 identification
// messages (type codes 1-4) from a live Beast-binary capture off a real
// dump1090-fa station - not synthetic. All three decode to real airline
// ICAO callsigns (American, Virgin, British Airways) at category 5
// (heavy), consistent with transatlantic wide-body traffic over the New
// England coast.
describe('decodeIdentification - real dump1090-fa Beast capture', () => {
  it.each([
    ['AB0969', '25041331e3082078028a', 'AAL180'],
    ['4066AB', '255894b1c42820313e57', 'VIR11B'],
    ['4006C4', '250815f1df606035bb23', 'BAW176A'],
  ])('decodes a real identification message from %s to %s', (_icao, meHex, expectedCallsign) => {
    const me = Uint8Array.from(Buffer.from(meHex, 'hex'));
    const result = decodeIdentification(me);
    expect(result.callsign).toBe(expectedCallsign);
    expect(result.category).toBe('heavy');
  });
});
