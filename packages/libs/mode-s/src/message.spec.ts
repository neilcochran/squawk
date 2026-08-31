import { describe, it, expect } from 'vitest';

import { computeCrc24 } from './frame.js';
import { decodeModeSMessage } from './message.js';
import { setBits } from './test-utils.js';

/** Builds a CRC-valid DF17 message: ICAO address plus an 11-byte ME field (type code + payload), with the trailing 3 CRC bytes computed to make the whole message check out. */
function buildValidDf17(icaoHexBytes: [number, number, number], me: Uint8Array): Uint8Array {
  const payload = Uint8Array.of(0x8d, ...icaoHexBytes, ...me);
  const crc = computeCrc24(Uint8Array.of(...payload, 0, 0, 0));
  return Uint8Array.of(...payload, (crc >> 16) & 0xff, (crc >> 8) & 0xff, crc & 0xff);
}

function hexBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

describe('decodeModeSMessage - DF17/18 CRC gate', () => {
  it('returns undefined for a DF17 message with a corrupted CRC', () => {
    const bytes = hexBytes('8dab096958c90106e9199e88d1a5');
    bytes[5] = (bytes[5] ?? 0) ^ 0x01; // flip a bit in the ME field, invalidating the CRC
    expect(decodeModeSMessage(bytes)).toBeUndefined();
  });
});

describe('decodeModeSMessage - unrecognized downlink formats', () => {
  it('returns undefined for a downlink format this package does not decode', () => {
    const bytes = new Uint8Array(7);
    bytes[0] = 2 << 3; // DF2 - unassigned in Mode-S, not decoded
    expect(decodeModeSMessage(bytes)).toBeUndefined();
  });

  it('returns undefined for a DF17 message with an unrecognized ADS-B type code', () => {
    // Type code 29 (target state and status) is a real, valid ADS-B type
    // this package deliberately does not decode.
    const me = new Uint8Array(7);
    me[0] = 29 << 3; // type code 29 in the top 5 bits
    const bytes = buildValidDf17([0xab, 0x09, 0x69], me);
    expect(decodeModeSMessage(bytes)).toBeUndefined();
  });

  it('returns undefined for a DF11 reply with an implausibly large CRC remainder', () => {
    // A genuine DF11's CRC remainder is a 7-bit interrogator code (0-127).
    // Construct a message whose CRC does not check out to a value that small.
    const bytes = hexBytes('5dab096930e668');
    bytes[3] = (bytes[3] ?? 0) ^ 0xff; // corrupt the ICAO address, changing the CRC remainder
    const result = decodeModeSMessage(bytes);
    if (result?.kind === 'allCallReply') {
      // The corruption happened to still land in the plausible range -
      // corrupt further to guarantee an implausible remainder.
      bytes[2] = (bytes[2] ?? 0) ^ 0xff;
    }
    expect(decodeModeSMessage(bytes)).toBeUndefined();
  });
});

// The DF11 messages below are real replies from a live Beast feed whose
// CRC remainders (18, 33, 49, 64, 66) are legitimate SI/IC-flagged
// interrogator codes, not corruption - initial testing here used only
// synthetic messages with small (0-15) II-style codes, and a live test
// against a real station surfaced that an earlier, too-narrow validity
// threshold was silently rejecting these as "implausible" and reporting
// them as undecoded. Locked in here as a regression check.
describe('decodeModeSMessage - real DF11 replies with SI-range interrogator codes', () => {
  it.each([
    ['5da93229942b43', 64],
    ['5d7380c29dd204', 33],
    ['5d4bb14b435b2a', 18],
    ['5da5376ff84480', 66],
    ['5d7380c29dd214', 49],
  ])('decodes a real DF11 reply with interrogator code %i rather than rejecting it', (hex) => {
    const result = decodeModeSMessage(hexBytes(hex));
    expect(result?.kind).toBe('allCallReply');
  });
});

// Messages below are the same real dump1090-fa Beast capture messages
// already individually verified in each sub-module's own real-capture
// tests (frame.spec.ts, cpr.spec.ts / bits.spec.ts, velocity.spec.ts,
// identification.spec.ts, altitude.spec.ts) - this is the integration
// point, confirming decodeModeSMessage dispatches each to the right
// decoder and assembles the right result shape.
describe('decodeModeSMessage - real dump1090-fa Beast capture', () => {
  it('decodes a real DF17 airborne position message', () => {
    const result = decodeModeSMessage(hexBytes('8dab096958c90106e9199e88d1a5'));
    expect(result).toEqual({
      kind: 'extendedSquitterPosition',
      icaoHex: 'AB0969',
      surface: false,
      cprFormat: 'even',
      latCpr: 33652,
      lonCpr: 72094,
      altitudeFt: 39000,
      groundSpeedKt: undefined,
      trueTrackDeg: undefined,
    });
  });

  it('decodes the paired odd-format position message', () => {
    const result = decodeModeSMessage(hexBytes('8dab096958c7f48b117e58d9b508'));
    expect(result).toEqual({
      kind: 'extendedSquitterPosition',
      icaoHex: 'AB0969',
      surface: false,
      cprFormat: 'odd',
      latCpr: 17800,
      lonCpr: 97880,
      altitudeFt: 38975,
      groundSpeedKt: undefined,
      trueTrackDeg: undefined,
    });
  });

  it('decodes a real DF17 airborne velocity message', () => {
    const result = decodeModeSMessage(hexBytes('8dab0969990a5502800835a7739c'));
    expect(result?.kind).toBe('extendedSquitterVelocity');
    if (result?.kind !== 'extendedSquitterVelocity') {
      return;
    }
    expect(result.icaoHex).toBe('AB0969');
    expect(result.velocity.subtype).toBe('groundSpeed');
    if (result.velocity.subtype !== 'groundSpeed') {
      return;
    }
    expect(result.velocity.groundSpeedKt).toBeCloseTo(596.3, 1);
    expect(result.velocity.trueTrackDeg).toBeCloseTo(88.17, 1);
  });

  it('decodes a real DF17 identification message', () => {
    const result = decodeModeSMessage(hexBytes('8dab096925041331e3082078028a'));
    expect(result).toEqual({
      kind: 'extendedSquitterIdentification',
      icaoHex: 'AB0969',
      identification: { callsign: 'AAL180', category: 'heavy' },
    });
  });

  it('decodes a real DF11 all-call reply', () => {
    const result = decodeModeSMessage(hexBytes('5dab096930e668'));
    expect(result).toEqual({ kind: 'allCallReply', icaoHex: 'AB0969' });
  });

  it('decodes a real DF4 surveillance altitude reply', () => {
    const result = decodeModeSMessage(hexBytes('200018bf425cd6'));
    expect(result?.kind).toBe('surveillanceAltitudeReply');
    if (result?.kind !== 'surveillanceAltitudeReply') {
      return;
    }
    // Matches the altitude independently decoded from the real DF17
    // position pair above, taken ~440ms apart from the same aircraft.
    expect(result.altitudeFt).toBe(38975);
  });

  it('decodes a real DF5 surveillance identity reply', () => {
    const result = decodeModeSMessage(hexBytes('28001d022de23c'));
    expect(result?.kind).toBe('surveillanceIdentityReply');
    if (result?.kind !== 'surveillanceIdentityReply') {
      return;
    }
    expect(result.squawk).toBe('1470');
  });

  it('decodes a real DF17 type-28 subtype-1 emergency status message', () => {
    // From the original beast-capture.bin, not the live station - a
    // routine (non-emergency) status broadcast, which subtype 1 aircraft
    // send continuously regardless of whether there's an actual emergency.
    const result = decodeModeSMessage(hexBytes('8dab0969e11d02000000004282bb'));
    expect(result?.kind).toBe('extendedSquitterEmergencyStatus');
    if (result?.kind !== 'extendedSquitterEmergencyStatus') {
      return;
    }
    expect(result.icaoHex).toBe('AB0969');
    expect(result.emergencyState).toBe('none');
  });
});

describe('decodeModeSMessage - surface position (synthetic)', () => {
  it('decodes movement and track instead of altitude for a surface position message', () => {
    const surfaceMe = new Uint8Array(7);
    setBits(surfaceMe, 0, 5, 6); // type code
    setBits(surfaceMe, 5, 7, 39); // movement -> 15 kt
    setBits(surfaceMe, 12, 1, 1); // track status valid
    setBits(surfaceMe, 13, 7, 64); // track raw 64 -> 64*360/128 = 180 deg

    const bytes = buildValidDf17([0xab, 0x09, 0x69], surfaceMe);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('extendedSquitterPosition');
    if (result?.kind !== 'extendedSquitterPosition') {
      return;
    }
    expect(result.surface).toBe(true);
    expect(result.altitudeFt).toBeUndefined();
    expect(result.groundSpeedKt).toBe(15);
    expect(result.trueTrackDeg).toBe(180);
  });
});

describe('decodeModeSMessage - emergency status (synthetic)', () => {
  it('decodes a type-28 subtype-1 message to emergency state and squawk', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 28); // type code
    setBits(me, 5, 3, 1); // subtype 1
    setBits(me, 8, 3, 5); // emergency state 5 = unlawfulInterference
    setBits(me, 11, 13, 0x0808); // idcode -> squawk "1200"

    const bytes = buildValidDf17([0xab, 0x09, 0x69], me);
    const result = decodeModeSMessage(bytes);
    expect(result).toEqual({
      kind: 'extendedSquitterEmergencyStatus',
      icaoHex: 'AB0969',
      emergencyState: 'unlawfulInterference',
      squawk: '1200',
    });
  });

  it('returns undefined for type-28 subtype 2 (TCAS/ACAS RA broadcast, out of scope)', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 28);
    setBits(me, 5, 3, 2);
    const bytes = buildValidDf17([0xab, 0x09, 0x69], me);
    expect(decodeModeSMessage(bytes)).toBeUndefined();
  });
});
