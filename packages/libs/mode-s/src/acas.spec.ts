import { describe, it, expect } from 'vitest';

import { decodeAcasResolutionAdvisory } from './acas.js';
import { decodeAltitudeCode } from './altitude.js';
import { setBits } from './test-utils.js';

/** Builds a 7-byte ACAS RA report payload (DF16's MV, or a type-28 subtype-2 ME) with only the given bit fields set. */
function buildPayload(fields: { offset: number; length: number; value: number }[]): Uint8Array {
  const bytes = new Uint8Array(7);
  for (const { offset, length, value } of fields) {
    setBits(bytes, offset, length, value);
  }
  return bytes;
}

describe('decodeAcasResolutionAdvisory - advisory type derivation', () => {
  it.each([
    // corrective, downwardSense, increasedRate, senseReversal, altitudeCrossing, positive, expected
    [1, 0, 0, 0, 0, 1, 'climb'],
    [1, 1, 0, 0, 0, 1, 'descend'],
    [1, 0, 0, 0, 1, 1, 'crossingClimb'],
    [1, 1, 0, 0, 1, 1, 'crossingDescend'],
    [1, 0, 1, 0, 0, 1, 'increaseClimb'],
    [1, 1, 1, 0, 0, 1, 'increaseDescent'],
    [1, 0, 0, 1, 0, 1, 'reversalToClimb'],
    [1, 1, 0, 1, 0, 1, 'reversalToDescend'],
    [1, 0, 0, 0, 0, 0, 'reduceDescent'],
    [1, 1, 0, 0, 0, 0, 'reduceClimb'],
    [0, 0, 0, 0, 0, 0, 'doNotDescend'],
    [0, 1, 0, 0, 0, 0, 'doNotClimb'],
  ] as const)(
    'corrective=%i downwardSense=%i increasedRate=%i senseReversal=%i altitudeCrossing=%i positive=%i -> %s',
    (
      corrective,
      downwardSense,
      increasedRate,
      senseReversal,
      altitudeCrossing,
      positive,
      expected,
    ) => {
      const payload = buildPayload([
        { offset: 8, length: 1, value: 1 }, // active
        { offset: 9, length: 1, value: corrective },
        { offset: 10, length: 1, value: downwardSense },
        { offset: 11, length: 1, value: increasedRate },
        { offset: 12, length: 1, value: senseReversal },
        { offset: 13, length: 1, value: altitudeCrossing },
        { offset: 14, length: 1, value: positive },
      ]);
      expect(decodeAcasResolutionAdvisory(payload)?.advisoryType).toBe(expected);
    },
  );

  it('reports no advisory type when no RA is active', () => {
    const payload = buildPayload([{ offset: 8, length: 1, value: 0 }]);
    const result = decodeAcasResolutionAdvisory(payload);
    expect(result?.active).toBe(false);
    expect(result?.advisoryType).toBeUndefined();
  });

  it('reports no advisory type for the undefined positive-preventive combination', () => {
    const payload = buildPayload([
      { offset: 8, length: 1, value: 1 }, // active
      { offset: 9, length: 1, value: 0 }, // preventive
      { offset: 14, length: 1, value: 1 }, // positive
    ]);
    expect(decodeAcasResolutionAdvisory(payload)?.advisoryType).toBeUndefined();
  });
});

describe('decodeAcasResolutionAdvisory - resolution advisory complement', () => {
  it('decodes the do-not-pass-below/above and reserved turn-left/right bits independently', () => {
    const payload = buildPayload([
      { offset: 22, length: 1, value: 1 }, // doNotPassBelow
      { offset: 23, length: 1, value: 0 },
      { offset: 24, length: 1, value: 1 }, // doNotTurnLeft
      { offset: 25, length: 1, value: 0 },
    ]);
    const result = decodeAcasResolutionAdvisory(payload);
    expect(result?.doNotPassBelow).toBe(true);
    expect(result?.doNotPassAbove).toBe(false);
    expect(result?.doNotTurnLeft).toBe(true);
    expect(result?.doNotTurnRight).toBe(false);
  });

  it('decodes the terminated and multiple-threat flags', () => {
    const payload = buildPayload([
      { offset: 26, length: 1, value: 1 }, // terminated
      { offset: 27, length: 1, value: 1 }, // multipleThreat
    ]);
    const result = decodeAcasResolutionAdvisory(payload);
    expect(result?.terminated).toBe(true);
    expect(result?.multipleThreat).toBe(true);
  });
});

describe('decodeAcasResolutionAdvisory - threat identity', () => {
  it('reports threatType none when TTI is 0', () => {
    const payload = buildPayload([{ offset: 28, length: 2, value: 0 }]);
    const result = decodeAcasResolutionAdvisory(payload);
    expect(result?.threat).toEqual({ threatType: 'none' });
  });

  it('decodes the threat ICAO address when TTI is 1', () => {
    const payload = buildPayload([
      { offset: 28, length: 2, value: 1 },
      { offset: 30, length: 24, value: 0xab0970 },
    ]);
    const result = decodeAcasResolutionAdvisory(payload);
    expect(result?.threat.threatType).toBe('icaoAddress');
    if (result?.threat.threatType !== 'icaoAddress') {
      return;
    }
    expect(result.threat.threatIcaoHex).toBe('AB0970');
  });

  it('decodes threat altitude, range, and bearing when TTI is 2', () => {
    const altitudeCode = 0x0abc;
    const payload = buildPayload([
      { offset: 28, length: 2, value: 2 },
      { offset: 30, length: 13, value: altitudeCode },
      { offset: 43, length: 7, value: 11 }, // (11-1)/10 = 1.0 nmi
      { offset: 50, length: 6, value: 21 }, // 6*(21-1)+3 = 123 deg
    ]);
    const result = decodeAcasResolutionAdvisory(payload);
    expect(result?.threat.threatType).toBe('altitudeRangeBearing');
    if (result?.threat.threatType !== 'altitudeRangeBearing') {
      return;
    }
    expect(result.threat.threatAltitudeFt).toBe(decodeAltitudeCode(altitudeCode));
    expect(result.threat.threatRangeNm).toBeCloseTo(1.0, 5);
    expect(result.threat.threatBearingDeg).toBe(123);
  });

  it('reports undefined range and bearing when their raw fields are zero (not available)', () => {
    const payload = buildPayload([{ offset: 28, length: 2, value: 2 }]);
    const result = decodeAcasResolutionAdvisory(payload);
    expect(result?.threat.threatType).toBe('altitudeRangeBearing');
    if (result?.threat.threatType !== 'altitudeRangeBearing') {
      return;
    }
    expect(result.threat.threatRangeNm).toBeUndefined();
    expect(result.threat.threatBearingDeg).toBeUndefined();
  });

  it('returns undefined for the whole report when TTI is the reserved value', () => {
    const payload = buildPayload([{ offset: 28, length: 2, value: 3 }]);
    expect(decodeAcasResolutionAdvisory(payload)).toBeUndefined();
  });
});
