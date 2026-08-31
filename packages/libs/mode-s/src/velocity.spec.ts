import { describe, it, expect } from 'vitest';

import { setBits } from './test-utils.js';
import { decodeAirborneVelocity } from './velocity.js';

interface GroundSpeedFields {
  subtype: 1 | 2;
  eastWestSign?: number;
  eastWestMagnitude?: number;
  northSouthSign?: number;
  northSouthMagnitude?: number;
  verticalRateSource?: number;
  verticalRateSign?: number;
  verticalRateMagnitude?: number;
  geoMinusBaroSign?: number;
  geoMinusBaroMagnitude?: number;
}

function buildGroundSpeedMe(fields: GroundSpeedFields): Uint8Array {
  const me = new Uint8Array(7);
  setBits(me, 0, 5, 19); // type code
  setBits(me, 5, 3, fields.subtype);
  setBits(me, 13, 1, fields.eastWestSign ?? 0);
  setBits(me, 14, 10, fields.eastWestMagnitude ?? 0);
  setBits(me, 24, 1, fields.northSouthSign ?? 0);
  setBits(me, 25, 10, fields.northSouthMagnitude ?? 0);
  setBits(me, 35, 1, fields.verticalRateSource ?? 0);
  setBits(me, 36, 1, fields.verticalRateSign ?? 0);
  setBits(me, 37, 9, fields.verticalRateMagnitude ?? 0);
  setBits(me, 48, 1, fields.geoMinusBaroSign ?? 0);
  setBits(me, 49, 7, fields.geoMinusBaroMagnitude ?? 0);
  return me;
}

interface AirSpeedFields {
  subtype: 3 | 4;
  headingStatus?: number;
  headingRaw?: number;
  airspeedType?: number;
  airspeedMagnitude?: number;
}

function buildAirSpeedMe(fields: AirSpeedFields): Uint8Array {
  const me = new Uint8Array(7);
  setBits(me, 0, 5, 19);
  setBits(me, 5, 3, fields.subtype);
  setBits(me, 13, 1, fields.headingStatus ?? 0);
  setBits(me, 14, 10, fields.headingRaw ?? 0);
  setBits(me, 24, 1, fields.airspeedType ?? 0);
  setBits(me, 25, 10, fields.airspeedMagnitude ?? 0);
  return me;
}

describe('decodeAirborneVelocity - ground speed subtypes', () => {
  it('decodes a subsonic (subtype 1) eastbound, northbound ground speed', () => {
    const me = buildGroundSpeedMe({
      subtype: 1,
      eastWestSign: 0,
      eastWestMagnitude: 101, // 100 kt east
      northSouthSign: 0,
      northSouthMagnitude: 101, // 100 kt north
    });
    const result = decodeAirborneVelocity(me);
    expect(result?.subtype).toBe('groundSpeed');
    if (result?.subtype !== 'groundSpeed') {
      return;
    }
    expect(result.groundSpeedKt).toBeCloseTo(141.42, 1); // sqrt(100^2+100^2)
    expect(result.trueTrackDeg).toBeCloseTo(45, 1);
  });

  it('decodes westbound, southbound as a track beyond 180 degrees', () => {
    const me = buildGroundSpeedMe({
      subtype: 1,
      eastWestSign: 1,
      eastWestMagnitude: 101,
      northSouthSign: 1,
      northSouthMagnitude: 101,
    });
    const result = decodeAirborneVelocity(me);
    expect(result?.subtype).toBe('groundSpeed');
    if (result?.subtype !== 'groundSpeed') {
      return;
    }
    expect(result.trueTrackDeg).toBeCloseTo(225, 1);
  });

  it('scales magnitude by 4x for supersonic (subtype 2)', () => {
    const subsonicMe = buildGroundSpeedMe({
      subtype: 1,
      eastWestMagnitude: 51,
      northSouthMagnitude: 1,
    });
    const supersonicMe = buildGroundSpeedMe({
      subtype: 2,
      eastWestMagnitude: 51,
      northSouthMagnitude: 1,
    });
    const subsonic = decodeAirborneVelocity(subsonicMe);
    const supersonic = decodeAirborneVelocity(supersonicMe);
    if (subsonic?.subtype !== 'groundSpeed' || supersonic?.subtype !== 'groundSpeed') {
      throw new Error('expected groundSpeed subtype');
    }
    expect(supersonic.groundSpeedKt).toBeCloseTo((subsonic.groundSpeedKt ?? 0) * 4, 1);
  });

  it('leaves groundSpeedKt and trueTrackDeg undefined when either magnitude is zero (not available)', () => {
    const me = buildGroundSpeedMe({ subtype: 1, eastWestMagnitude: 0, northSouthMagnitude: 101 });
    const result = decodeAirborneVelocity(me);
    expect(result?.subtype).toBe('groundSpeed');
    if (result?.subtype !== 'groundSpeed') {
      return;
    }
    expect(result.groundSpeedKt).toBeUndefined();
    expect(result.trueTrackDeg).toBeUndefined();
  });
});

describe('decodeAirborneVelocity - airspeed subtypes', () => {
  it('decodes indicated airspeed with a valid heading', () => {
    const me = buildAirSpeedMe({
      subtype: 3,
      headingStatus: 1,
      headingRaw: 512, // 512/1024 * 360 = 180 deg
      airspeedType: 0,
      airspeedMagnitude: 251, // 250 kt IAS
    });
    const result = decodeAirborneVelocity(me);
    expect(result?.subtype).toBe('airSpeed');
    if (result?.subtype !== 'airSpeed') {
      return;
    }
    expect(result.indicatedAirspeedKt).toBe(250);
    expect(result.trueAirspeedKt).toBeUndefined();
    expect(result.magneticHeadingDeg).toBeCloseTo(180, 1);
  });

  it('decodes true airspeed instead of indicated when the type bit is set', () => {
    const me = buildAirSpeedMe({ subtype: 3, airspeedType: 1, airspeedMagnitude: 301 });
    const result = decodeAirborneVelocity(me);
    expect(result?.subtype).toBe('airSpeed');
    if (result?.subtype !== 'airSpeed') {
      return;
    }
    expect(result.trueAirspeedKt).toBe(300);
    expect(result.indicatedAirspeedKt).toBeUndefined();
  });

  it('leaves magneticHeadingDeg undefined when the heading status bit is unset', () => {
    const me = buildAirSpeedMe({ subtype: 3, headingStatus: 0, headingRaw: 512 });
    const result = decodeAirborneVelocity(me);
    expect(result?.subtype).toBe('airSpeed');
    if (result?.subtype !== 'airSpeed') {
      return;
    }
    expect(result.magneticHeadingDeg).toBeUndefined();
  });

  it('scales magnitude by 4x for supersonic (subtype 4)', () => {
    const me = buildAirSpeedMe({ subtype: 4, airspeedMagnitude: 51 });
    const result = decodeAirborneVelocity(me);
    expect(result?.subtype).toBe('airSpeed');
    if (result?.subtype !== 'airSpeed') {
      return;
    }
    expect(result.indicatedAirspeedKt).toBe(200);
  });
});

describe('decodeAirborneVelocity - common trailer', () => {
  it('decodes a climbing, barometric-sourced vertical rate', () => {
    const me = buildGroundSpeedMe({
      subtype: 1,
      verticalRateSource: 1,
      verticalRateSign: 0,
      verticalRateMagnitude: 17, // (17-1)*64 = 1024 ft/min
    });
    const result = decodeAirborneVelocity(me);
    expect(result?.verticalRateFtPerMin).toBe(1024);
    expect(result?.verticalRateSource).toBe('barometric');
  });

  it('decodes a descending, GNSS-sourced vertical rate', () => {
    const me = buildGroundSpeedMe({
      subtype: 1,
      verticalRateSource: 0,
      verticalRateSign: 1,
      verticalRateMagnitude: 17,
    });
    const result = decodeAirborneVelocity(me);
    expect(result?.verticalRateFtPerMin).toBe(-1024);
    expect(result?.verticalRateSource).toBe('gnss');
  });

  it('leaves verticalRateFtPerMin undefined when the magnitude is zero', () => {
    const me = buildGroundSpeedMe({ subtype: 1, verticalRateMagnitude: 0 });
    expect(decodeAirborneVelocity(me)?.verticalRateFtPerMin).toBeUndefined();
  });

  it('decodes a positive geo-minus-baro altitude difference', () => {
    const me = buildGroundSpeedMe({ subtype: 1, geoMinusBaroSign: 0, geoMinusBaroMagnitude: 5 });
    expect(decodeAirborneVelocity(me)?.geoMinusBaroAltitudeFt).toBe(100); // (5-1)*25
  });

  it('decodes a negative geo-minus-baro altitude difference', () => {
    const me = buildGroundSpeedMe({ subtype: 1, geoMinusBaroSign: 1, geoMinusBaroMagnitude: 5 });
    expect(decodeAirborneVelocity(me)?.geoMinusBaroAltitudeFt).toBe(-100);
  });

  it('leaves geoMinusBaroAltitudeFt undefined at the sentinel magnitudes 0 and 127', () => {
    expect(
      decodeAirborneVelocity(buildGroundSpeedMe({ subtype: 1, geoMinusBaroMagnitude: 0 }))
        ?.geoMinusBaroAltitudeFt,
    ).toBeUndefined();
    expect(
      decodeAirborneVelocity(buildGroundSpeedMe({ subtype: 1, geoMinusBaroMagnitude: 127 }))
        ?.geoMinusBaroAltitudeFt,
    ).toBeUndefined();
  });
});

describe('decodeAirborneVelocity - invalid subtype', () => {
  it('returns undefined for subtype 0 (not one of the four defined values)', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 19); // type code, subtype left at 0
    expect(decodeAirborneVelocity(me)).toBeUndefined();
  });
});

// ME fields below are the 7-byte ME payload of real DF17 airborne velocity
// messages (type code 19) from a live Beast-binary capture off a real
// dump1090-fa station - not synthetic. All four are subtype 1 (subsonic
// ground speed) jets at cruise, consistent with the 400-600kt ground
// speeds and the ~40000ft altitudes seen from the same aircraft's position
// messages elsewhere in the capture.
describe('decodeAirborneVelocity - real dump1090-fa Beast capture', () => {
  it.each([
    ['AB0969', '990a5502800835a7739c', 596.3, 88.17, 64, 'gnss'],
    ['4066AB', '990c84b2588c26c76055', 421.86, 198.09, -2176, 'barometric'],
    ['AA9212', '9912251850043ae2f649', 580.99, 70.6, 0, 'barometric'],
  ] as const)(
    'decodes a real subtype-1 ground speed message from %s',
    (_icao, meHex, expectedSpeed, expectedTrack, expectedVr, expectedVrSource) => {
      const me = Uint8Array.from(Buffer.from(meHex, 'hex'));
      const result = decodeAirborneVelocity(me);
      expect(result?.subtype).toBe('groundSpeed');
      if (result?.subtype !== 'groundSpeed') {
        return;
      }
      expect(result.groundSpeedKt).toBeCloseTo(expectedSpeed, 1);
      expect(result.trueTrackDeg).toBeCloseTo(expectedTrack, 1);
      expect(result.verticalRateFtPerMin).toBe(expectedVr);
      expect(result.verticalRateSource).toBe(expectedVrSource);
    },
  );
});
