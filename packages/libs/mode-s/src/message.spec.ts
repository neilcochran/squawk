import { describe, it, expect } from 'vitest';

import { decodeAltitudeCode } from './altitude.js';
import { decodeFlightStatus } from './flight-status.js';
import { computeCrc24 } from './frame.js';
import { decodeIdentityCode } from './identity.js';
import { decodeModeSMessage } from './message.js';
import { setBits } from './test-utils.js';

/** Builds a CRC-valid DF17 message: ICAO address plus an 11-byte ME field (type code + payload), with the trailing 3 CRC bytes computed to make the whole message check out. */
function buildValidDf17(icaoHexBytes: [number, number, number], me: Uint8Array): Uint8Array {
  const payload = Uint8Array.of(0x8d, ...icaoHexBytes, ...me);
  const crc = computeCrc24(Uint8Array.of(...payload, 0, 0, 0));
  return Uint8Array.of(...payload, (crc >> 16) & 0xff, (crc >> 8) & 0xff, crc & 0xff);
}

/** Builds a CRC-valid DF18 message with the given control field - otherwise identical to {@link buildValidDf17}. */
function buildValidDf18(
  controlField: number,
  icaoHexBytes: [number, number, number],
  me: Uint8Array,
): Uint8Array {
  const payload = Uint8Array.of((18 << 3) | controlField, ...icaoHexBytes, ...me);
  const crc = computeCrc24(Uint8Array.of(...payload, 0, 0, 0));
  return Uint8Array.of(...payload, (crc >> 16) & 0xff, (crc >> 8) & 0xff, crc & 0xff);
}

/** XORs a CRC-24 computed over `bytes` (AP field still zeroed) with `icaoHexBytes` and writes the result into the last 3 bytes of `bytes`, the way a real transponder computes the address-parity field for a targeted reply (DF0/4/5/16/20/21) - see {@link ModeSMessageEnvelope.crcRemainder}. */
function writeAddressParityCrc(bytes: Uint8Array, icaoHexBytes: [number, number, number]): void {
  const contentCrc = computeCrc24(bytes);
  const icao = (icaoHexBytes[0] << 16) | (icaoHexBytes[1] << 8) | icaoHexBytes[2];
  const ap = contentCrc ^ icao;
  const apOffset = bytes.length - 3;
  bytes[apOffset] = (ap >> 16) & 0xff;
  bytes[apOffset + 1] = (ap >> 8) & 0xff;
  bytes[apOffset + 2] = ap & 0xff;
}

/** Builds a DF0 message with the given vertical-status bit and altitude code. */
function buildDf0(
  verticalStatus: 0 | 1,
  altitudeCode: number,
  icaoHexBytes: [number, number, number],
): Uint8Array {
  const bytes = new Uint8Array(7);
  setBits(bytes, 0, 5, 0); // DF0
  setBits(bytes, 5, 1, verticalStatus);
  setBits(bytes, 19, 13, altitudeCode);
  writeAddressParityCrc(bytes, icaoHexBytes);
  return bytes;
}

/** Builds a DF16 message with the given vertical-status bit, altitude code, and 7-byte MV field. */
function buildDf16(
  verticalStatus: 0 | 1,
  altitudeCode: number,
  mv: Uint8Array,
  icaoHexBytes: [number, number, number],
): Uint8Array {
  const bytes = new Uint8Array(14);
  setBits(bytes, 0, 5, 16); // DF16
  setBits(bytes, 5, 1, verticalStatus);
  setBits(bytes, 19, 13, altitudeCode);
  bytes.set(mv, 4);
  writeAddressParityCrc(bytes, icaoHexBytes);
  return bytes;
}

/** Builds a DF20 message with the given altitude code and 7-byte MB field. `flightStatus` defaults to 0 (no alert, no ident). */
function buildDf20(
  altitudeCode: number,
  mb: Uint8Array,
  icaoHexBytes: [number, number, number],
  flightStatus = 0,
): Uint8Array {
  const bytes = new Uint8Array(14);
  setBits(bytes, 0, 5, 20); // DF20
  setBits(bytes, 5, 3, flightStatus);
  setBits(bytes, 19, 13, altitudeCode);
  bytes.set(mb, 4);
  writeAddressParityCrc(bytes, icaoHexBytes);
  return bytes;
}

/** Builds a DF21 message with the given identity (squawk) code and 7-byte MB field. `flightStatus` defaults to 0 (no alert, no ident). */
function buildDf21(
  idCode: number,
  mb: Uint8Array,
  icaoHexBytes: [number, number, number],
  flightStatus = 0,
): Uint8Array {
  const bytes = new Uint8Array(14);
  setBits(bytes, 0, 5, 21); // DF21
  setBits(bytes, 5, 3, flightStatus);
  setBits(bytes, 19, 13, idCode);
  bytes.set(mb, 4);
  writeAddressParityCrc(bytes, icaoHexBytes);
  return bytes;
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
    // Type code 23 is reserved (per DO-260B) and not decoded by this package.
    const me = new Uint8Array(7);
    me[0] = 23 << 3; // type code 23 in the top 5 bits
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

// Regression coverage for a length-vs-downlink-format mismatch: every
// downlink format implies a fixed message length (short/56-bit for DF<16,
// long/112-bit for DF>=16), and a `bytes` array whose length doesn't match
// what its own DF field implies means the buffer is truncated or corrupted,
// not a genuine message of that format. Before this guard, a corrupted
// 7-byte DF0 reply whose leading bit misread as DF16 caused the ACAS
// resolution-advisory decoder to read zero-padded phantom bytes and
// fabricate a plausible-looking Resolution Advisory instead of correctly
// reporting undecoded.
describe('decodeModeSMessage - length must match the downlink format', () => {
  it('rejects a 1-byte buffer whose downlink format bits happen to read as DF11', () => {
    const bytes = Uint8Array.of(0x58); // top 5 bits = 0b01011 = 11 (DF11)
    expect(decodeModeSMessage(bytes)).toBeUndefined();
  });

  it('rejects a corrupted 7-byte DF0 reply whose leading bit misreads as DF16', () => {
    const bytes = buildDf0(0, 0x0abc, [0xab, 0x09, 0x69]);
    bytes[0] = (bytes[0] ?? 0) | 0x80; // flip the MSB: DF 0b00000 -> 0b10000 (16)
    expect(decodeModeSMessage(bytes)).toBeUndefined();
  });

  it('rejects a 14-byte message whose downlink format implies a short (7-byte) message', () => {
    const mv = new Uint8Array(7);
    const bytes = buildDf16(0, 0x0abc, mv, [0xab, 0x09, 0x69]);
    bytes[0] = (bytes[0] ?? 0) & 0x7f; // clear the MSB: DF 0b10000 -> 0b00000 (0)
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
      messageSource: 'icaoDirect',
      surface: false,
      cprFormat: 'even',
      latCpr: 33652,
      lonCpr: 72094,
      baroAltitudeFt: 39000,
      geoAltitudeFt: undefined,
      groundSpeedKt: undefined,
      trueTrackDeg: undefined,
    });
  });

  it('decodes the paired odd-format position message', () => {
    const result = decodeModeSMessage(hexBytes('8dab096958c7f48b117e58d9b508'));
    expect(result).toEqual({
      kind: 'extendedSquitterPosition',
      icaoHex: 'AB0969',
      messageSource: 'icaoDirect',
      surface: false,
      cprFormat: 'odd',
      latCpr: 17800,
      lonCpr: 97880,
      baroAltitudeFt: 38975,
      geoAltitudeFt: undefined,
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
      messageSource: 'icaoDirect',
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
    // Flight Status field is 0 in this capture - routine cruise traffic.
    expect(result.identActive).toBe(false);
    expect(result.squawkAlert).toBe(false);
  });

  it('decodes a real DF5 surveillance identity reply', () => {
    const result = decodeModeSMessage(hexBytes('28001d022de23c'));
    expect(result?.kind).toBe('surveillanceIdentityReply');
    if (result?.kind !== 'surveillanceIdentityReply') {
      return;
    }
    expect(result.squawk).toBe('1470');
    // Flight Status field is 0 in this capture - routine cruise traffic.
    expect(result.identActive).toBe(false);
    expect(result.squawkAlert).toBe(false);
  });

  it('decodes a synthetic DF20 Comm-B altitude reply, including its BDS 4,0 register', () => {
    const acField = 6335;
    const mb = new Uint8Array(7);
    setBits(mb, 0, 1, 1); // MCP/FCU altitude status
    setBits(mb, 1, 12, 300); // 300*16 = 4800 ft

    const bytes = buildDf20(acField, mb, [0xab, 0x09, 0x69]);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('commBAltitudeReply');
    if (result?.kind !== 'commBAltitudeReply') {
      return;
    }
    expect(result.candidateIcaoHex).toBe('AB0969');
    expect(result.altitudeFt).toBe(decodeAltitudeCode(acField));
    expect(
      result.commBRegisters.some(
        (register) => register.bdsCode === '4,0' && register.mcpFcuSelectedAltitudeFt === 4800,
      ),
    ).toBe(true);
  });

  it('decodes a synthetic DF21 Comm-B identity reply, including its BDS 4,0 register', () => {
    const idField = 0b0_001_0100_0111_0;
    const mb = new Uint8Array(7);
    setBits(mb, 0, 1, 1); // MCP/FCU altitude status
    setBits(mb, 1, 12, 300); // 300*16 = 4800 ft

    const bytes = buildDf21(idField, mb, [0xab, 0x09, 0x69]);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('commBIdentityReply');
    if (result?.kind !== 'commBIdentityReply') {
      return;
    }
    expect(result.candidateIcaoHex).toBe('AB0969');
    expect(result.squawk).toBe(decodeIdentityCode(idField));
    expect(
      result.commBRegisters.some(
        (register) => register.bdsCode === '4,0' && register.mcpFcuSelectedAltitudeFt === 4800,
      ),
    ).toBe(true);
  });

  it('decodes an alerting Flight Status on a DF20 Comm-B altitude reply', () => {
    const mb = new Uint8Array(7);
    const bytes = buildDf20(6335, mb, [0xab, 0x09, 0x69], 2); // FS 2: alert, no ident
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('commBAltitudeReply');
    if (result?.kind !== 'commBAltitudeReply') {
      return;
    }
    expect(result.identActive).toBe(decodeFlightStatus(2).identActive);
    expect(result.squawkAlert).toBe(decodeFlightStatus(2).squawkAlert);
  });

  it('decodes an identing Flight Status on a DF21 Comm-B identity reply', () => {
    const mb = new Uint8Array(7);
    const idField = 0b0_001_0100_0111_0;
    const bytes = buildDf21(idField, mb, [0xab, 0x09, 0x69], 5); // FS 5: ident, no alert
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('commBIdentityReply');
    if (result?.kind !== 'commBIdentityReply') {
      return;
    }
    expect(result.identActive).toBe(decodeFlightStatus(5).identActive);
    expect(result.squawkAlert).toBe(decodeFlightStatus(5).squawkAlert);
  });

  it('reports identActive/squawkAlert as undefined for a reserved Flight Status value', () => {
    const mb = new Uint8Array(7);
    const bytes = buildDf20(6335, mb, [0xab, 0x09, 0x69], 7); // FS 7: reserved
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('commBAltitudeReply');
    if (result?.kind !== 'commBAltitudeReply') {
      return;
    }
    expect(result.identActive).toBeUndefined();
    expect(result.squawkAlert).toBeUndefined();
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
    expect(result.baroAltitudeFt).toBeUndefined();
    expect(result.geoAltitudeFt).toBeUndefined();
    expect(result.groundSpeedKt).toBe(15);
    expect(result.trueTrackDeg).toBe(180);
  });

  it('reports no track when the track status bit is unset', () => {
    const surfaceMe = new Uint8Array(7);
    setBits(surfaceMe, 0, 5, 6); // type code
    setBits(surfaceMe, 12, 1, 0); // track status invalid
    setBits(surfaceMe, 13, 7, 64); // track raw present but must be ignored

    const bytes = buildValidDf17([0xab, 0x09, 0x69], surfaceMe);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('extendedSquitterPosition');
    if (result?.kind !== 'extendedSquitterPosition') {
      return;
    }
    expect(result.trueTrackDeg).toBeUndefined();
  });
});

describe('decodeModeSMessage - airborne GNSS position (synthetic)', () => {
  it('decodes GNSS height in meters to feet for a type-code-20-22 position message', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 20); // type code 20: airborne GNSS position
    setBits(me, 8, 12, 1000); // 1000 m

    const bytes = buildValidDf17([0xab, 0x09, 0x69], me);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('extendedSquitterPosition');
    if (result?.kind !== 'extendedSquitterPosition') {
      return;
    }
    expect(result.surface).toBe(false);
    expect(result.geoAltitudeFt).toBe(Math.round(1000 * 3.28084));
    expect(result.baroAltitudeFt).toBeUndefined();
  });
});

describe('decodeModeSMessage - airborne velocity with an unrecognized subtype (synthetic)', () => {
  it('returns undefined for a type-code-19 message whose subtype is not one of the four defined values', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 19); // type code 19: airborne velocity
    setBits(me, 5, 3, 0); // subtype 0 is not defined

    const bytes = buildValidDf17([0xab, 0x09, 0x69], me);
    expect(decodeModeSMessage(bytes)).toBeUndefined();
  });
});

describe('decodeModeSMessage - target state and status (synthetic)', () => {
  it('dispatches a type-code-29 message to extendedSquitterTargetStateAndStatus', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 29); // type code
    setBits(me, 9, 11, 101); // (101-1)*32 = 3200 ft
    setBits(me, 39, 4, 9); // NAC_p

    const bytes = buildValidDf17([0xab, 0x09, 0x69], me);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('extendedSquitterTargetStateAndStatus');
    if (result?.kind !== 'extendedSquitterTargetStateAndStatus') {
      return;
    }
    expect(result.icaoHex).toBe('AB0969');
    expect(result.messageSource).toBe('icaoDirect');
    expect(result.targetStateAndStatus.selectedAltitudeFt).toBe(3200);
    expect(result.targetStateAndStatus.navAccuracyCategoryPosition).toBe(9);
  });
});

describe('decodeModeSMessage - operational status (synthetic)', () => {
  it('dispatches a type-code-31 message to extendedSquitterOperationalStatus', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 31); // type code
    setBits(me, 5, 3, 0); // subtype: airborne
    setBits(me, 40, 3, 2); // ADS-B version 2

    const bytes = buildValidDf17([0xab, 0x09, 0x69], me);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('extendedSquitterOperationalStatus');
    if (result?.kind !== 'extendedSquitterOperationalStatus') {
      return;
    }
    expect(result.icaoHex).toBe('AB0969');
    expect(result.messageSource).toBe('icaoDirect');
    expect(result.operationalStatus.surface).toBe(false);
    expect(result.operationalStatus.adsbVersion).toBe(2);
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
      messageSource: 'icaoDirect',
      emergencyState: 'unlawfulInterference',
      squawk: '1200',
    });
  });

  it('decodes a type-28 subtype-2 message to an ACAS Resolution Advisory broadcast', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 28); // type code
    setBits(me, 5, 3, 2); // subtype 2
    setBits(me, 8, 1, 1); // active
    setBits(me, 9, 1, 1); // corrective
    setBits(me, 14, 1, 1); // positive
    setBits(me, 28, 2, 1); // TTI = icaoAddress
    setBits(me, 30, 24, 0xab0970); // threat ICAO address

    const bytes = buildValidDf17([0xab, 0x09, 0x69], me);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('extendedSquitterAcasRaBroadcast');
    if (result?.kind !== 'extendedSquitterAcasRaBroadcast') {
      return;
    }
    expect(result.icaoHex).toBe('AB0969');
    expect(result.resolutionAdvisory.active).toBe(true);
    expect(result.resolutionAdvisory.advisoryType).toBe('climb');
    expect(result.resolutionAdvisory.threat.threatType).toBe('icaoAddress');
    if (result.resolutionAdvisory.threat.threatType !== 'icaoAddress') {
      return;
    }
    expect(result.resolutionAdvisory.threat.threatIcaoHex).toBe('AB0970');
  });

  it('returns undefined for type-28 subtype 2 with the reserved Threat Type Indicator value', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 28);
    setBits(me, 5, 3, 2);
    setBits(me, 28, 2, 3); // TTI = reserved
    const bytes = buildValidDf17([0xab, 0x09, 0x69], me);
    expect(decodeModeSMessage(bytes)).toBeUndefined();
  });

  it('returns undefined for a type-28 subtype outside 1/2 (reserved)', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 28);
    setBits(me, 5, 3, 0); // subtype 0 is reserved
    const bytes = buildValidDf17([0xab, 0x09, 0x69], me);
    expect(decodeModeSMessage(bytes)).toBeUndefined();
  });
});

describe('decodeModeSMessage - DF18 control field gating (synthetic)', () => {
  /** A minimal type-code-1 identification ME field - only used here to confirm dispatch, not to exercise identification decoding itself (covered in identification.spec.ts). */
  function identificationMe(): Uint8Array {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 1);
    return me;
  }

  it.each([
    [0, 'icaoDirect'],
    [1, 'anonymousDirect'],
    [2, 'icaoTisb'],
    [5, 'anonymousTisb'],
    [6, 'adsr'],
  ] as const)(
    'decodes a DF18 message with control field %i as messageSource %s',
    (controlField, expectedMessageSource) => {
      const bytes = buildValidDf18(controlField, [0xab, 0x09, 0x69], identificationMe());
      const result = decodeModeSMessage(bytes);
      expect(result?.kind).toBe('extendedSquitterIdentification');
      if (result?.kind !== 'extendedSquitterIdentification') {
        return;
      }
      expect(result.messageSource).toBe(expectedMessageSource);
    },
  );

  it('reports messageSource icaoDirect for a DF17 message, which has no control field', () => {
    const bytes = buildValidDf17([0xab, 0x09, 0x69], identificationMe());
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('extendedSquitterIdentification');
    if (result?.kind !== 'extendedSquitterIdentification') {
      return;
    }
    expect(result.messageSource).toBe('icaoDirect');
  });

  it.each([3, 4, 7])(
    'returns undefined for a DF18 message with control field %i (not decoded)',
    (controlField) => {
      const bytes = buildValidDf18(controlField, [0xab, 0x09, 0x69], identificationMe());
      expect(decodeModeSMessage(bytes)).toBeUndefined();
    },
  );
});

describe('decodeModeSMessage - DF0 short air-air surveillance reply (synthetic)', () => {
  it('decodes altitude and an airborne vertical status', () => {
    const bytes = buildDf0(0, 0x0abc, [0xab, 0x09, 0x69]);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('shortAirAirSurveillanceReply');
    if (result?.kind !== 'shortAirAirSurveillanceReply') {
      return;
    }
    expect(result.candidateIcaoHex).toBe('AB0969');
    expect(result.surface).toBe(false);
    expect(result.altitudeFt).toBe(decodeAltitudeCode(0x0abc));
  });

  it('decodes an on-ground vertical status', () => {
    const bytes = buildDf0(1, 0x0abc, [0xab, 0x09, 0x69]);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('shortAirAirSurveillanceReply');
    if (result?.kind !== 'shortAirAirSurveillanceReply') {
      return;
    }
    expect(result.surface).toBe(true);
  });
});

describe('decodeModeSMessage - DF16 long air-air surveillance reply (synthetic)', () => {
  function activeClimbMv(): Uint8Array {
    const mv = new Uint8Array(7);
    setBits(mv, 0, 8, 0x30); // BDS 3,0 register identifier
    setBits(mv, 8, 1, 1); // active
    setBits(mv, 9, 1, 1); // corrective
    setBits(mv, 14, 1, 1); // positive
    return mv;
  }

  it('decodes altitude, vertical status, and the embedded resolution advisory', () => {
    const bytes = buildDf16(0, 0x0abc, activeClimbMv(), [0xab, 0x09, 0x69]);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('longAirAirSurveillanceReply');
    if (result?.kind !== 'longAirAirSurveillanceReply') {
      return;
    }
    expect(result.candidateIcaoHex).toBe('AB0969');
    expect(result.surface).toBe(false);
    expect(result.altitudeFt).toBe(decodeAltitudeCode(0x0abc));
    expect(result.resolutionAdvisory?.active).toBe(true);
    expect(result.resolutionAdvisory?.advisoryType).toBe('climb');
  });

  it('still reports altitude and address when the resolution advisory has a reserved Threat Type Indicator', () => {
    const mv = activeClimbMv();
    setBits(mv, 28, 2, 3); // TTI = reserved
    const bytes = buildDf16(0, 0x0abc, mv, [0xab, 0x09, 0x69]);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('longAirAirSurveillanceReply');
    if (result?.kind !== 'longAirAirSurveillanceReply') {
      return;
    }
    expect(result.altitudeFt).toBe(decodeAltitudeCode(0x0abc));
    expect(result.resolutionAdvisory).toBeUndefined();
  });

  it("still reports altitude and address but drops resolutionAdvisory when MV isn't a BDS 3,0 register", () => {
    const mv = new Uint8Array(7);
    setBits(mv, 0, 8, 0x10); // a different Comm-B register, not BDS 3,0
    setBits(mv, 8, 1, 1); // bits that would read as an active climb RA if misinterpreted as BDS 3,0
    setBits(mv, 9, 1, 1);
    setBits(mv, 14, 1, 1);
    const bytes = buildDf16(0, 0x0abc, mv, [0xab, 0x09, 0x69]);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('longAirAirSurveillanceReply');
    if (result?.kind !== 'longAirAirSurveillanceReply') {
      return;
    }
    expect(result.altitudeFt).toBe(decodeAltitudeCode(0x0abc));
    expect(result.resolutionAdvisory).toBeUndefined();
  });
});

describe('decodeModeSMessage - type code 0 airborne position, no position information (synthetic)', () => {
  it('omits latCpr/lonCpr while still decoding altitude', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 0); // type code 0
    setBits(me, 8, 12, 0x1234); // altitude field (nonzero, arbitrary)
    // CPR fields would normally live at bits 22-38/39-55 - leave populated
    // with nonzero bits to prove the decoder ignores them for type code 0
    // rather than merely happening to see zeros.
    setBits(me, 22, 17, 0x1ffff);
    setBits(me, 39, 17, 0x1ffff);

    const bytes = buildValidDf17([0xab, 0x09, 0x69], me);
    const result = decodeModeSMessage(bytes);
    expect(result?.kind).toBe('extendedSquitterPosition');
    if (result?.kind !== 'extendedSquitterPosition') {
      return;
    }
    expect(result.latCpr).toBeUndefined();
    expect(result.lonCpr).toBeUndefined();
    expect(result.baroAltitudeFt).toBeDefined();
    expect(result.geoAltitudeFt).toBeUndefined();
  });
});
