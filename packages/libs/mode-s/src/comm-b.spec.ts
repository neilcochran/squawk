import { describe, it, expect } from 'vitest';

import {
  decodeHeadingAndSpeedReport,
  decodeSelectedVerticalIntention,
  decodeTrackAndTurnReport,
  inferCommBRegisters,
} from './comm-b.js';
import { setBits } from './test-utils.js';

describe('decodeSelectedVerticalIntention', () => {
  it('decodes a fully-populated message', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 0, 1, 1); // MCP/FCU altitude status
    setBits(mb, 1, 12, 300); // 300*16 = 4800 ft
    setBits(mb, 13, 1, 1); // FMS altitude status
    setBits(mb, 14, 12, 250); // 250*16 = 4000 ft
    setBits(mb, 26, 1, 1); // baro pressure status
    setBits(mb, 27, 12, 2128); // 2128*0.1+800 = 1012.8 mb
    setBits(mb, 47, 1, 1); // mode status
    setBits(mb, 48, 1, 1); // vnav
    setBits(mb, 49, 1, 0); // altitude hold
    setBits(mb, 50, 1, 1); // approach
    setBits(mb, 53, 1, 1); // target altitude source status
    setBits(mb, 54, 2, 2); // mcpFcu

    const result = decodeSelectedVerticalIntention(mb);
    expect(result.bdsCode).toBe('4,0');
    expect(result.mcpFcuSelectedAltitudeFt).toBe(4800);
    expect(result.fmsSelectedAltitudeFt).toBe(4000);
    expect(result.baroPressureSettingMb).toBeCloseTo(1012.8, 5);
    expect(result.vnavModeActive).toBe(true);
    expect(result.altitudeHoldModeActive).toBe(false);
    expect(result.approachModeActive).toBe(true);
    expect(result.targetAltitudeSource).toBe('mcpFcu');
  });

  it('reports all fields as undefined when no status bits are set', () => {
    const result = decodeSelectedVerticalIntention(new Uint8Array(7));
    expect(result.mcpFcuSelectedAltitudeFt).toBeUndefined();
    expect(result.fmsSelectedAltitudeFt).toBeUndefined();
    expect(result.baroPressureSettingMb).toBeUndefined();
    expect(result.vnavModeActive).toBeUndefined();
    expect(result.altitudeHoldModeActive).toBeUndefined();
    expect(result.approachModeActive).toBeUndefined();
    expect(result.targetAltitudeSource).toBeUndefined();
  });

  it.each([
    [0, 'unknown'],
    [1, 'aircraftAltitude'],
    [2, 'mcpFcu'],
    [3, 'fms'],
  ] as const)('maps target altitude source raw value %i to %s', (raw, expected) => {
    const mb = new Uint8Array(7);
    setBits(mb, 53, 1, 1);
    setBits(mb, 54, 2, raw);
    expect(decodeSelectedVerticalIntention(mb).targetAltitudeSource).toBe(expected);
  });
});

describe('decodeTrackAndTurnReport', () => {
  it('decodes a fully-populated message with a negative roll and a wrapped track angle', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 0, 1, 1); // roll status
    setBits(mb, 1, 1, 1); // roll sign (negative)
    setBits(mb, 2, 9, 480); // signed -32 -> -32*45/256 = -5.625 deg
    setBits(mb, 11, 1, 1); // track status
    setBits(mb, 12, 1, 1); // track sign (negative)
    setBits(mb, 13, 10, 512); // signed -512 -> -90 deg -> normalized to 270
    setBits(mb, 23, 1, 1); // groundspeed status
    setBits(mb, 24, 10, 150); // 150*2 = 300 kt
    setBits(mb, 34, 1, 1); // track angle rate status
    setBits(mb, 35, 1, 0); // sign (positive)
    setBits(mb, 36, 9, 8); // 8*8/256 = 0.25 deg/s
    setBits(mb, 45, 1, 1); // true airspeed status
    setBits(mb, 46, 10, 140); // 140*2 = 280 kt

    expect(decodeTrackAndTurnReport(mb)).toEqual({
      bdsCode: '5,0',
      rollAngleDeg: -5.625,
      trueTrackDeg: 270,
      groundSpeedKt: 300,
      trackAngleRateDegPerSec: 0.25,
      trueAirspeedKt: 280,
    });
  });

  it('reports all fields as undefined when no status bits are set', () => {
    const result = decodeTrackAndTurnReport(new Uint8Array(7));
    expect(result.rollAngleDeg).toBeUndefined();
    expect(result.trueTrackDeg).toBeUndefined();
    expect(result.groundSpeedKt).toBeUndefined();
    expect(result.trackAngleRateDegPerSec).toBeUndefined();
    expect(result.trueAirspeedKt).toBeUndefined();
  });
});

describe('decodeHeadingAndSpeedReport', () => {
  it('decodes a fully-populated message with negative and positive vertical rates', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 0, 1, 1); // heading status
    setBits(mb, 1, 1, 0); // heading sign (positive)
    setBits(mb, 2, 10, 512); // 512*90/512 = 90 deg
    setBits(mb, 12, 1, 1); // IAS status
    setBits(mb, 13, 10, 250); // 250 kt
    setBits(mb, 23, 1, 1); // mach status
    setBits(mb, 24, 10, 200); // 200*2.048/512 = 0.8
    setBits(mb, 34, 1, 1); // barometric vertical rate status
    setBits(mb, 35, 1, 1); // sign (negative)
    setBits(mb, 36, 9, 462); // signed -50 -> -1600 ft/min
    setBits(mb, 45, 1, 1); // inertial vertical rate status
    setBits(mb, 46, 1, 0); // sign (positive)
    setBits(mb, 47, 9, 50); // 50*32 = 1600 ft/min

    const result = decodeHeadingAndSpeedReport(mb);
    expect(result.bdsCode).toBe('6,0');
    expect(result.magneticHeadingDeg).toBe(90);
    expect(result.indicatedAirspeedKt).toBe(250);
    expect(result.mach).toBeCloseTo(0.8, 5);
    expect(result.baroVerticalRateFtPerMin).toBe(-1600);
    expect(result.inertialVerticalRateFtPerMin).toBe(1600);
  });

  it('reports all fields as undefined when no status bits are set', () => {
    const result = decodeHeadingAndSpeedReport(new Uint8Array(7));
    expect(result.magneticHeadingDeg).toBeUndefined();
    expect(result.indicatedAirspeedKt).toBeUndefined();
    expect(result.mach).toBeUndefined();
    expect(result.baroVerticalRateFtPerMin).toBeUndefined();
    expect(result.inertialVerticalRateFtPerMin).toBeUndefined();
  });
});

describe('inferCommBRegisters', () => {
  it('returns no candidates for an all-zero MB field', () => {
    expect(inferCommBRegisters(new Uint8Array(7))).toEqual([]);
  });

  it('excludes BDS 4,0 when reserved bits 39-46 are nonzero', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 39, 8, 1);
    expect(inferCommBRegisters(mb).some((candidate) => candidate.bdsCode === '4,0')).toBe(false);
  });

  it('excludes BDS 4,0 when a status bit is 0 but its value field is nonzero', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 1, 12, 5); // MCP altitude value set, but status bit 0 left unset
    expect(inferCommBRegisters(mb).some((candidate) => candidate.bdsCode === '4,0')).toBe(false);
  });

  it('excludes BDS 5,0 when the roll angle exceeds the plausible range', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 0, 1, 1); // roll status
    setBits(mb, 1, 1, 0); // sign positive
    setBits(mb, 2, 9, 500); // 500*45/256 ~= 87.9 deg, over the 35 deg threshold
    expect(inferCommBRegisters(mb).some((candidate) => candidate.bdsCode === '5,0')).toBe(false);
  });

  it('excludes BDS 5,0 when true airspeed exceeds the plausible range', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 45, 1, 1); // true airspeed status
    setBits(mb, 46, 10, 400); // 400*2 = 800 kt, over the 600kt threshold
    expect(inferCommBRegisters(mb).some((candidate) => candidate.bdsCode === '5,0')).toBe(false);
  });

  it('excludes BDS 5,0 when groundspeed and true airspeed disagree by more than 200kt', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 23, 1, 1); // groundspeed status
    setBits(mb, 24, 10, 50); // 100 kt - individually within range
    setBits(mb, 45, 1, 1); // true airspeed status
    setBits(mb, 46, 10, 175); // 350 kt - individually within range, but 250kt apart from groundspeed
    expect(inferCommBRegisters(mb).some((candidate) => candidate.bdsCode === '5,0')).toBe(false);
  });

  it('excludes BDS 6,0 when Mach exceeds 1.0', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 23, 1, 1); // mach status
    setBits(mb, 24, 10, 1000); // 1000*2.048/512 ~= 4.0, over 1.0
    expect(inferCommBRegisters(mb).some((candidate) => candidate.bdsCode === '6,0')).toBe(false);
  });

  it('excludes BDS 6,0 when a vertical rate exceeds the plausible range', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 34, 1, 1); // barometric vertical rate status
    setBits(mb, 35, 1, 0); // sign positive
    setBits(mb, 36, 9, 500); // 500*32 = 16000 ft/min, over the 6000 threshold
    expect(inferCommBRegisters(mb).some((candidate) => candidate.bdsCode === '6,0')).toBe(false);
  });

  it('excludes BDS 6,0 when the inertial vertical rate exceeds the plausible range', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 45, 1, 1); // inertial vertical rate status
    setBits(mb, 46, 1, 0); // sign positive
    setBits(mb, 47, 9, 500); // 500*32 = 16000 ft/min, over the 6000 threshold
    expect(inferCommBRegisters(mb).some((candidate) => candidate.bdsCode === '6,0')).toBe(false);
  });

  it('excludes BDS 6,0 when indicated airspeed exceeds the plausible range', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 12, 1, 1); // IAS status
    setBits(mb, 13, 10, 600); // over the 500kt threshold
    expect(inferCommBRegisters(mb).some((candidate) => candidate.bdsCode === '6,0')).toBe(false);
  });

  it('reports BDS 4,0 as a candidate for a plausible selected-vertical-intention payload', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 0, 1, 1); // MCP/FCU altitude status
    setBits(mb, 1, 12, 300); // 4800 ft
    const candidates = inferCommBRegisters(mb);
    const match = candidates.find((candidate) => candidate.bdsCode === '4,0');
    expect(match).toBeDefined();
    expect(match).toMatchObject({ mcpFcuSelectedAltitudeFt: 4800 });
  });

  it('reports BDS 6,0 as a candidate for a plausible heading-and-speed payload', () => {
    const mb = new Uint8Array(7);
    setBits(mb, 34, 1, 1); // barometric vertical rate status
    setBits(mb, 35, 1, 0); // sign positive
    setBits(mb, 36, 9, 50); // 50*32 = 1600 ft/min, within range
    const candidates = inferCommBRegisters(mb);
    const match = candidates.find((candidate) => candidate.bdsCode === '6,0');
    expect(match).toBeDefined();
    expect(match).toMatchObject({ baroVerticalRateFtPerMin: 1600 });
  });

  describe('wrongStatus consistency checks', () => {
    it.each([
      ['MCP/FCU altitude', 1, 12],
      ['FMS altitude', 14, 12],
      ['baro pressure setting', 27, 12],
      ['MCP mode', 48, 3],
      ['target altitude source', 54, 2],
    ] as const)(
      'excludes BDS 4,0 when the %s value is nonzero but its status bit is 0',
      (_field, valueStart, valueWidth) => {
        const mb = new Uint8Array(7);
        setBits(mb, valueStart, valueWidth, 1);
        expect(inferCommBRegisters(mb).some((candidate) => candidate.bdsCode === '4,0')).toBe(
          false,
        );
      },
    );

    it.each([
      ['roll', 1, 10],
      ['true track', 12, 11],
      ['groundspeed', 24, 10],
      ['track angle rate', 35, 10],
      ['true airspeed', 46, 10],
    ] as const)(
      'excludes BDS 5,0 when the %s value is nonzero but its status bit is 0',
      (_field, valueStart, valueWidth) => {
        const mb = new Uint8Array(7);
        setBits(mb, valueStart, valueWidth, 1);
        expect(inferCommBRegisters(mb).some((candidate) => candidate.bdsCode === '5,0')).toBe(
          false,
        );
      },
    );

    it.each([
      ['magnetic heading', 1, 11],
      ['indicated airspeed', 13, 10],
      ['mach', 24, 10],
      ['barometric vertical rate', 35, 10],
      ['inertial vertical rate', 46, 10],
    ] as const)(
      'excludes BDS 6,0 when the %s value is nonzero but its status bit is 0',
      (_field, valueStart, valueWidth) => {
        const mb = new Uint8Array(7);
        setBits(mb, valueStart, valueWidth, 1);
        expect(inferCommBRegisters(mb).some((candidate) => candidate.bdsCode === '6,0')).toBe(
          false,
        );
      },
    );
  });
});
