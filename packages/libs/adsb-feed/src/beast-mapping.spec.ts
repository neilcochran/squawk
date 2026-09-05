import { describe, it, expect, vi } from 'vitest';

import { cprNumLongitudeZones } from '@squawk/mode-s';
import type {
  AllCallReply,
  CprPosition,
  ExtendedSquitterAcasRaBroadcast,
  ExtendedSquitterEmergencyStatus,
  ExtendedSquitterIdentification,
  ExtendedSquitterPosition,
  ExtendedSquitterTargetStateAndStatus,
  ExtendedSquitterVelocity,
  LongAirAirSurveillanceReply,
  ModeAcReply,
  ShortAirAirSurveillanceReply,
  SurveillanceIdentityReply,
} from '@squawk/mode-s';
import type { AcasResolutionAdvisoryReport, Aircraft, TargetStateAndStatus } from '@squawk/types';

import { createBeastMapper } from './beast-mapping.js';

const CPR_DENOMINATOR = 131072;
const ICAO_HEX = 'A0B1C2';

const TARGET_STATE: TargetStateAndStatus = {
  selectedAltitudeSource: 'fms',
  selectedAltitudeFt: 3200,
  baroPressureSettingMb: 1013.2,
  selectedHeadingDeg: 180,
  navAccuracyCategoryPosition: 9,
  nicBaro: true,
  sourceIntegrityLevel: 2,
  autopilotEngaged: true,
  vnavModeActive: true,
  altitudeHoldModeActive: false,
  approachModeActive: false,
  lnavModeActive: true,
  tcasOperational: true,
};

const RESOLUTION_ADVISORY: AcasResolutionAdvisoryReport = {
  active: true,
  advisoryType: 'climb',
  corrective: true,
  downwardSense: false,
  increasedRate: false,
  senseReversal: false,
  altitudeCrossing: false,
  positive: true,
  doNotPassBelow: false,
  doNotPassAbove: false,
  doNotTurnLeft: false,
  doNotTurnRight: false,
  terminated: false,
  multipleThreat: false,
  threat: { threatType: 'none' },
};

function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/**
 * Test-only inverse of the CPR encoding, mirroring `@squawk/mode-s`'s own
 * `cpr.spec.ts` helper - round-trips a known truth position into raw CPR
 * fields so the pairing/reference tests below exercise realistic,
 * mathematically-valid values instead of arbitrary numbers.
 */
function encodeAirborneCpr(lat: number, lon: number, format: 'even' | 'odd'): CprPosition {
  const dLat = format === 'odd' ? 360 / 59 : 360 / 60;
  const latCpr = Math.round((mod(lat, dLat) / dLat) * CPR_DENOMINATOR) % CPR_DENOMINATOR;
  const ni = Math.max(cprNumLongitudeZones(lat) - (format === 'odd' ? 1 : 0), 1);
  const dLon = 360 / ni;
  const lonCpr = Math.round((mod(lon, dLon) / dLon) * CPR_DENOMINATOR) % CPR_DENOMINATOR;
  return { latCpr, lonCpr };
}

function encodeSurfaceCpr(lat: number, lon: number, format: 'even' | 'odd'): CprPosition {
  const dLat = format === 'odd' ? 90 / 59 : 90 / 60;
  const latCpr = Math.round((mod(lat, dLat) / dLat) * CPR_DENOMINATOR) % CPR_DENOMINATOR;
  const ni = Math.max(cprNumLongitudeZones(lat) - (format === 'odd' ? 1 : 0), 1);
  const dLon = 90 / ni;
  const lonCpr = Math.round((mod(lon, dLon) / dLon) * CPR_DENOMINATOR) % CPR_DENOMINATOR;
  return { latCpr, lonCpr };
}

function positionMessage(
  overrides: Partial<ExtendedSquitterPosition> = {},
): ExtendedSquitterPosition {
  return {
    kind: 'extendedSquitterPosition',
    icaoHex: ICAO_HEX,
    messageSource: 'icaoDirect',
    surface: false,
    cprFormat: 'even',
    latCpr: undefined,
    lonCpr: undefined,
    baroAltitudeFt: undefined,
    geoAltitudeFt: undefined,
    groundSpeedKt: undefined,
    trueTrackDeg: undefined,
    ...overrides,
  };
}

function noKnownAircraft(): undefined {
  return undefined;
}

describe('map', () => {
  it('returns undefined for an undecoded frame', () => {
    const mapper = createBeastMapper();
    expect(mapper.map(undefined, noKnownAircraft)).toBeUndefined();
  });

  it('returns undefined for a Mode A/C reply (no ICAO address to key on)', () => {
    const mapper = createBeastMapper();
    const reply: ModeAcReply = {
      kind: 'modeAc',
      squawk: '1200',
      identActive: false,
      altitudeFt: 5000,
    };
    expect(mapper.map(reply, noKnownAircraft)).toBeUndefined();
  });

  describe('extendedSquitterPosition', () => {
    it('maps a type-code-0 message (no position fix) to an icaoHex-only onGround update', () => {
      const mapper = createBeastMapper();
      const update = mapper.map(positionMessage(), noKnownAircraft);
      expect(update).toEqual({ icaoHex: ICAO_HEX, onGround: false });
    });

    it('maps barometric altitude (type codes 9-18) to baroAltitudeFt', () => {
      const mapper = createBeastMapper();
      const update = mapper.map(positionMessage({ baroAltitudeFt: 5500 }), noKnownAircraft);
      expect(update).toEqual({ icaoHex: ICAO_HEX, onGround: false, baroAltitudeFt: 5500 });
    });

    it('maps GNSS-height altitude (type codes 20-22) to geoAltitudeFt, not baroAltitudeFt', () => {
      const mapper = createBeastMapper();
      const update = mapper.map(positionMessage({ geoAltitudeFt: 5620 }), noKnownAircraft);
      expect(update).toEqual({ icaoHex: ICAO_HEX, onGround: false, geoAltitudeFt: 5620 });
    });

    it('maps surface groundSpeedKt/trueTrackDeg', () => {
      const mapper = createBeastMapper();
      const update = mapper.map(
        positionMessage({ surface: true, groundSpeedKt: 12, trueTrackDeg: 45 }),
        noKnownAircraft,
      );
      expect(update).toEqual({
        icaoHex: ICAO_HEX,
        onGround: true,
        groundSpeedKt: 12,
        trueTrackDeg: 45,
      });
    });

    it('resolves an airborne position from a paired even/odd frame', () => {
      const mapper = createBeastMapper();
      const lat = 40.6413;
      const lon = -73.7781;
      const even = encodeAirborneCpr(lat, lon, 'even');
      const odd = encodeAirborneCpr(lat, lon, 'odd');

      mapper.map(positionMessage({ cprFormat: 'even', ...even }), noKnownAircraft);
      const update = mapper.map(positionMessage({ cprFormat: 'odd', ...odd }), noKnownAircraft);

      expect(update?.lat).toBeCloseTo(lat, 2);
      expect(update?.lon).toBeCloseTo(lon, 2);
    });

    it("resolves a single airborne frame against the aircraft's own last known position", () => {
      const mapper = createBeastMapper();
      const lat = 40.6413;
      const lon = -73.7781;
      const frame = encodeAirborneCpr(lat, lon, 'even');
      const known: Aircraft = {
        icaoHex: ICAO_HEX,
        lastSeenAt: Date.now(),
        position: { lat: lat + 0.01, lon: lon - 0.01 },
      };

      const update = mapper.map(positionMessage({ cprFormat: 'even', ...frame }), () => known);

      expect(update?.lat).toBeCloseTo(lat, 2);
      expect(update?.lon).toBeCloseTo(lon, 2);
    });

    it('resolves a single airborne frame against the configured receiverPosition for a new aircraft', () => {
      const lat = 40.6413;
      const lon = -73.7781;
      const mapper = createBeastMapper({ receiverPosition: { lat: lat + 0.01, lon: lon - 0.01 } });
      const frame = encodeAirborneCpr(lat, lon, 'even');

      const update = mapper.map(positionMessage({ cprFormat: 'even', ...frame }), noKnownAircraft);

      expect(update?.lat).toBeCloseTo(lat, 2);
      expect(update?.lon).toBeCloseTo(lon, 2);
    });

    it('omits lat/lon for a single airborne frame with no pair and no reference available', () => {
      const mapper = createBeastMapper();
      const frame = encodeAirborneCpr(40.6413, -73.7781, 'even');

      const update = mapper.map(positionMessage({ cprFormat: 'even', ...frame }), noKnownAircraft);

      expect(update?.lat).toBeUndefined();
      expect(update?.lon).toBeUndefined();
    });

    it('does not pair frames more than 10s apart', () => {
      vi.useFakeTimers();
      try {
        const mapper = createBeastMapper();
        const lat = 40.6413;
        const lon = -73.7781;
        const even = encodeAirborneCpr(lat, lon, 'even');
        const odd = encodeAirborneCpr(lat, lon, 'odd');

        mapper.map(positionMessage({ cprFormat: 'even', ...even }), noKnownAircraft);
        vi.advanceTimersByTime(10_001);
        const update = mapper.map(positionMessage({ cprFormat: 'odd', ...odd }), noKnownAircraft);

        expect(update?.lat).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it('requires a reference position to resolve surface CPR, even for a paired frame', () => {
      const mapper = createBeastMapper();
      const lat = 33.9425;
      const lon = -118.408;
      const even = encodeSurfaceCpr(lat, lon, 'even');
      const odd = encodeSurfaceCpr(lat, lon, 'odd');

      mapper.map(positionMessage({ surface: true, cprFormat: 'even', ...even }), noKnownAircraft);
      const update = mapper.map(
        positionMessage({ surface: true, cprFormat: 'odd', ...odd }),
        noKnownAircraft,
      );

      expect(update?.lat).toBeUndefined();
    });

    it('resolves a paired surface frame given a receiverPosition reference', () => {
      const lat = 33.9425;
      const lon = -118.408;
      const mapper = createBeastMapper({ receiverPosition: { lat, lon } });
      const even = encodeSurfaceCpr(lat, lon, 'even');
      const odd = encodeSurfaceCpr(lat, lon, 'odd');

      mapper.map(positionMessage({ surface: true, cprFormat: 'even', ...even }), noKnownAircraft);
      const update = mapper.map(
        positionMessage({ surface: true, cprFormat: 'odd', ...odd }),
        noKnownAircraft,
      );

      expect(update?.lat).toBeCloseTo(lat, 2);
      expect(update?.lon).toBeCloseTo(lon, 2);
    });
  });

  describe('extendedSquitterVelocity', () => {
    it('maps a ground-speed subtype', () => {
      const mapper = createBeastMapper();
      const message: ExtendedSquitterVelocity = {
        kind: 'extendedSquitterVelocity',
        icaoHex: ICAO_HEX,
        messageSource: 'icaoDirect',
        velocity: {
          subtype: 'groundSpeed',
          groundSpeedKt: 420,
          trueTrackDeg: 271.4,
          verticalRateFtPerMin: -640,
          verticalRateSource: 'barometric',
          geoMinusBaroAltitudeFt: undefined,
        },
      };
      expect(mapper.map(message, noKnownAircraft)).toEqual({
        icaoHex: ICAO_HEX,
        groundSpeedKt: 420,
        trueTrackDeg: 271.4,
        verticalRateFtPerMin: -640,
      });
    });

    it('maps an air-speed subtype', () => {
      const mapper = createBeastMapper();
      const message: ExtendedSquitterVelocity = {
        kind: 'extendedSquitterVelocity',
        icaoHex: ICAO_HEX,
        messageSource: 'icaoDirect',
        velocity: {
          subtype: 'airSpeed',
          indicatedAirspeedKt: 250,
          trueAirspeedKt: 265,
          magneticHeadingDeg: 90,
          verticalRateFtPerMin: undefined,
          verticalRateSource: 'gnss',
          geoMinusBaroAltitudeFt: undefined,
        },
      };
      expect(mapper.map(message, noKnownAircraft)).toEqual({
        icaoHex: ICAO_HEX,
        indicatedAirspeedKt: 250,
        trueAirspeedKt: 265,
        magneticHeadingDeg: 90,
      });
    });
  });

  it('maps extendedSquitterIdentification to callsign/category', () => {
    const mapper = createBeastMapper();
    const message: ExtendedSquitterIdentification = {
      kind: 'extendedSquitterIdentification',
      icaoHex: ICAO_HEX,
      messageSource: 'icaoDirect',
      identification: { callsign: 'UAL123', category: 'large' },
    };
    expect(mapper.map(message, noKnownAircraft)).toEqual({
      icaoHex: ICAO_HEX,
      callsign: 'UAL123',
      category: 'large',
    });
  });

  it('maps extendedSquitterEmergencyStatus to squawk and emergencyState', () => {
    const mapper = createBeastMapper();
    const message: ExtendedSquitterEmergencyStatus = {
      kind: 'extendedSquitterEmergencyStatus',
      icaoHex: ICAO_HEX,
      messageSource: 'icaoDirect',
      emergencyState: 'unlawfulInterference',
      squawk: '7500',
    };
    expect(mapper.map(message, noKnownAircraft)).toEqual({
      icaoHex: ICAO_HEX,
      squawk: '7500',
      emergencyState: 'unlawfulInterference',
    });
  });

  it('maps extendedSquitterTargetStateAndStatus to targetState', () => {
    const mapper = createBeastMapper();
    const message: ExtendedSquitterTargetStateAndStatus = {
      kind: 'extendedSquitterTargetStateAndStatus',
      icaoHex: ICAO_HEX,
      messageSource: 'icaoDirect',
      targetStateAndStatus: TARGET_STATE,
    };
    expect(mapper.map(message, noKnownAircraft)).toEqual({
      icaoHex: ICAO_HEX,
      targetState: TARGET_STATE,
    });
  });

  it('maps extendedSquitterAcasRaBroadcast to resolutionAdvisory', () => {
    const mapper = createBeastMapper();
    const message: ExtendedSquitterAcasRaBroadcast = {
      kind: 'extendedSquitterAcasRaBroadcast',
      icaoHex: ICAO_HEX,
      messageSource: 'icaoDirect',
      resolutionAdvisory: RESOLUTION_ADVISORY,
    };
    expect(mapper.map(message, noKnownAircraft)).toEqual({
      icaoHex: ICAO_HEX,
      resolutionAdvisory: RESOLUTION_ADVISORY,
    });
  });

  it('maps allCallReply to an icaoHex-only update', () => {
    const mapper = createBeastMapper();
    const message: AllCallReply = { kind: 'allCallReply', icaoHex: ICAO_HEX };
    expect(mapper.map(message, noKnownAircraft)).toEqual({ icaoHex: ICAO_HEX });
  });

  describe('candidateIcaoHex cross-check (DF0/4/5/16/20/21)', () => {
    it('drops a reply whose candidateIcaoHex is not already known', () => {
      const mapper = createBeastMapper();
      const message: ShortAirAirSurveillanceReply = {
        kind: 'shortAirAirSurveillanceReply',
        candidateIcaoHex: ICAO_HEX,
        surface: false,
        altitudeFt: 5000,
      };
      expect(mapper.map(message, noKnownAircraft)).toBeUndefined();
    });

    it('ingests a reply whose candidateIcaoHex matches an already-tracked aircraft', () => {
      const mapper = createBeastMapper();
      const known: Aircraft = { icaoHex: ICAO_HEX, lastSeenAt: Date.now() };
      const message: ShortAirAirSurveillanceReply = {
        kind: 'shortAirAirSurveillanceReply',
        candidateIcaoHex: ICAO_HEX,
        surface: false,
        altitudeFt: 5000,
      };
      expect(mapper.map(message, () => known)).toEqual({ icaoHex: ICAO_HEX, baroAltitudeFt: 5000 });
    });

    it('maps a squawk-carrying reply (DF5/21) to squawk rather than altitude, plus identActive/squawkAlert', () => {
      const mapper = createBeastMapper();
      const known: Aircraft = { icaoHex: ICAO_HEX, lastSeenAt: Date.now() };
      const message: SurveillanceIdentityReply = {
        kind: 'surveillanceIdentityReply',
        candidateIcaoHex: ICAO_HEX,
        squawk: '1200',
        identActive: true,
        squawkAlert: false,
      };
      expect(mapper.map(message, () => known)).toEqual({
        icaoHex: ICAO_HEX,
        squawk: '1200',
        identActive: true,
        squawkAlert: false,
      });
    });

    it('omits identActive/squawkAlert when the Flight Status was reserved (both undefined)', () => {
      const mapper = createBeastMapper();
      const known: Aircraft = { icaoHex: ICAO_HEX, lastSeenAt: Date.now() };
      const message: SurveillanceIdentityReply = {
        kind: 'surveillanceIdentityReply',
        candidateIcaoHex: ICAO_HEX,
        squawk: '1200',
        identActive: undefined,
        squawkAlert: undefined,
      };
      expect(mapper.map(message, () => known)).toEqual({ icaoHex: ICAO_HEX, squawk: '1200' });
    });

    it("maps a DF16 reply's embedded resolutionAdvisory alongside altitude", () => {
      const mapper = createBeastMapper();
      const known: Aircraft = { icaoHex: ICAO_HEX, lastSeenAt: Date.now() };
      const message: LongAirAirSurveillanceReply = {
        kind: 'longAirAirSurveillanceReply',
        candidateIcaoHex: ICAO_HEX,
        surface: false,
        altitudeFt: 5000,
        resolutionAdvisory: RESOLUTION_ADVISORY,
      };
      expect(mapper.map(message, () => known)).toEqual({
        icaoHex: ICAO_HEX,
        baroAltitudeFt: 5000,
        resolutionAdvisory: RESOLUTION_ADVISORY,
      });
    });

    it('drops resolutionAdvisory from a DF16 reply that carries none (reserved Threat Type Indicator)', () => {
      const mapper = createBeastMapper();
      const known: Aircraft = { icaoHex: ICAO_HEX, lastSeenAt: Date.now() };
      const message: LongAirAirSurveillanceReply = {
        kind: 'longAirAirSurveillanceReply',
        candidateIcaoHex: ICAO_HEX,
        surface: false,
        altitudeFt: 5000,
        resolutionAdvisory: undefined,
      };
      expect(mapper.map(message, () => known)).toEqual({ icaoHex: ICAO_HEX, baroAltitudeFt: 5000 });
    });
  });
});

describe('forget', () => {
  it('clears CPR pairing state so a later frame cannot pair against a pre-forget frame', () => {
    const mapper = createBeastMapper();
    const lat = 40.6413;
    const lon = -73.7781;
    const even = encodeAirborneCpr(lat, lon, 'even');
    const odd = encodeAirborneCpr(lat, lon, 'odd');

    mapper.map(positionMessage({ cprFormat: 'even', ...even }), noKnownAircraft);
    mapper.forget(ICAO_HEX);
    const update = mapper.map(positionMessage({ cprFormat: 'odd', ...odd }), noKnownAircraft);

    expect(update?.lat).toBeUndefined();
  });
});
