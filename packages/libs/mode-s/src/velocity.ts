import { extractBits } from './bits.js';
import type {
  AirborneVelocity,
  AirborneVelocityCommon,
  AirSpeedVelocity,
  GroundSpeedVelocity,
} from './types/index.js';

/**
 * Decodes the vertical-rate and geometric/barometric altitude-difference
 * fields shared by both airborne velocity subtypes.
 */
function decodeCommonTrailer(me: Uint8Array): AirborneVelocityCommon {
  const verticalRateSource: 'gnss' | 'barometric' =
    extractBits(me, 35, 1) === 1 ? 'barometric' : 'gnss';
  const verticalRateSign = extractBits(me, 36, 1);
  const verticalRateMagnitude = extractBits(me, 37, 9);
  const verticalRateFtPerMin =
    verticalRateMagnitude === 0
      ? undefined
      : (verticalRateSign === 1 ? -1 : 1) * (verticalRateMagnitude - 1) * 64;

  const diffSign = extractBits(me, 48, 1);
  const diffMagnitude = extractBits(me, 49, 7);
  const geoMinusBaroAltitudeFt =
    diffMagnitude === 0 || diffMagnitude === 127
      ? undefined
      : (diffSign === 1 ? -1 : 1) * (diffMagnitude - 1) * 25;

  return { verticalRateFtPerMin, verticalRateSource, geoMinusBaroAltitudeFt };
}

function decodeGroundSpeed(
  me: Uint8Array,
  subtype: 1 | 2,
  common: AirborneVelocityCommon,
): GroundSpeedVelocity {
  const eastWestSign = extractBits(me, 13, 1);
  const eastWestMagnitude = extractBits(me, 14, 10);
  const northSouthSign = extractBits(me, 24, 1);
  const northSouthMagnitude = extractBits(me, 25, 10);

  if (eastWestMagnitude === 0 || northSouthMagnitude === 0) {
    return { subtype: 'groundSpeed', groundSpeedKt: undefined, trueTrackDeg: undefined, ...common };
  }

  const scale = subtype === 2 ? 4 : 1;
  const eastWest = (eastWestMagnitude - 1) * scale;
  const northSouth = (northSouthMagnitude - 1) * scale;
  const velocityEast = eastWestSign === 1 ? -eastWest : eastWest;
  const velocityNorth = northSouthSign === 1 ? -northSouth : northSouth;

  const groundSpeedKt = Math.sqrt(velocityEast * velocityEast + velocityNorth * velocityNorth);
  let trueTrackDeg = (Math.atan2(velocityEast, velocityNorth) * 180) / Math.PI;
  if (trueTrackDeg < 0) {
    trueTrackDeg += 360;
  }

  return { subtype: 'groundSpeed', groundSpeedKt, trueTrackDeg, ...common };
}

function decodeAirSpeed(
  me: Uint8Array,
  subtype: 3 | 4,
  common: AirborneVelocityCommon,
): AirSpeedVelocity {
  const headingStatus = extractBits(me, 13, 1);
  const headingRaw = extractBits(me, 14, 10);
  const airspeedType = extractBits(me, 24, 1);
  const airspeedMagnitude = extractBits(me, 25, 10);

  const magneticHeadingDeg = headingStatus === 0 ? undefined : (headingRaw / 1024) * 360;

  const scale = subtype === 4 ? 4 : 1;
  const airspeedKt = airspeedMagnitude === 0 ? undefined : (airspeedMagnitude - 1) * scale;
  const isTrueAirspeed = airspeedType === 1;

  return {
    subtype: 'airSpeed',
    indicatedAirspeedKt: isTrueAirspeed ? undefined : airspeedKt,
    trueAirspeedKt: isTrueAirspeed ? airspeedKt : undefined,
    magneticHeadingDeg,
    ...common,
  };
}

/**
 * Decodes an ADS-B airborne velocity message (BDS 0,9, type code 19).
 *
 * @param me - The 7-byte ME field of a DF17/18 message whose type code is 19.
 * @returns The decoded velocity, or undefined if the subtype field is not one of the four defined values (1-4).
 */
export function decodeAirborneVelocity(me: Uint8Array): AirborneVelocity | undefined {
  const subtype = extractBits(me, 5, 3);
  const common = decodeCommonTrailer(me);

  if (subtype === 1 || subtype === 2) {
    return decodeGroundSpeed(me, subtype, common);
  }
  if (subtype === 3 || subtype === 4) {
    return decodeAirSpeed(me, subtype, common);
  }
  return undefined;
}
