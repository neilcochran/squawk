import { decodeAdsbGnssAltitude, decodeAdsbPositionAltitude, decodeAltitudeCode } from './altitude.js';
import { extractBits } from './bits.js';
import { decodeEmergencyState } from './emergency-status.js';
import { parseModeSFrame } from './frame.js';
import { decodeIdentification } from './identification.js';
import { decodeIdentityCode } from './identity.js';
import { decodeSurfaceMovement } from './surface-movement.js';
import type { DecodedModeSMessage, ExtendedSquitterPosition } from './types/index.js';
import { decodeAirborneVelocity } from './velocity.js';

/**
 * DF11's CRC remainder carries a 7-bit interrogator code field: a 1-bit IC
 * selector plus a 6-bit value, either a legacy 4-bit II code (IC=1, low 2
 * bits unused) or a denser 6-bit SI code (IC=0) used where more than 16
 * co-located interrogators are in play - real values up to 127 are
 * legitimate. A larger remainder than this suggests a corrupted message
 * rather than a legitimate code.
 */
const MAX_PLAUSIBLE_INTERROGATOR_CODE = 127;

/** ADS-B type codes this package decodes, grouped by shared handling. Adding support for another type code means adding one entry here and one case in decodeExtendedSquitter's switch - the categories below are the complete, auditable list of what this package does and does not decode from a DF17/18 message. */
type TypeCodeCategory =
  | 'identification'
  | 'surfacePosition'
  | 'airborneBaroPosition'
  | 'velocity'
  | 'airborneGnssPosition'
  | 'emergencyStatus';

const TYPE_CODE_CATEGORIES: readonly { min: number; max: number; category: TypeCodeCategory }[] = [
  { min: 1, max: 4, category: 'identification' },
  { min: 5, max: 8, category: 'surfacePosition' },
  { min: 9, max: 18, category: 'airborneBaroPosition' },
  { min: 19, max: 19, category: 'velocity' },
  { min: 20, max: 22, category: 'airborneGnssPosition' },
  { min: 28, max: 28, category: 'emergencyStatus' },
];

function categorizeTypeCode(typeCode: number): TypeCodeCategory | undefined {
  return TYPE_CODE_CATEGORIES.find(({ min, max }) => typeCode >= min && typeCode <= max)?.category;
}

function hexAddress(bytes: Uint8Array, byteOffset: number): string {
  const b0 = (bytes[byteOffset] ?? 0).toString(16).padStart(2, '0');
  const b1 = (bytes[byteOffset + 1] ?? 0).toString(16).padStart(2, '0');
  const b2 = (bytes[byteOffset + 2] ?? 0).toString(16).padStart(2, '0');
  return (b0 + b1 + b2).toUpperCase();
}

function crcToHexAddress(crcRemainder: number): string {
  return crcRemainder.toString(16).padStart(6, '0').toUpperCase();
}

/** Decodes the three position-carrying categories (surface, airborne baro, airborne GNSS) - identical CPR field layout, differing only in what replaces the altitude bits for a surface message. */
function decodePositionMessage(
  me: Uint8Array,
  icaoHex: string,
  category: 'surfacePosition' | 'airborneBaroPosition' | 'airborneGnssPosition',
): ExtendedSquitterPosition {
  const isSurface = category === 'surfacePosition';
  const cprFormat = extractBits(me, 21, 1) === 1 ? 'odd' : 'even';
  const latCpr = extractBits(me, 22, 17);
  const lonCpr = extractBits(me, 39, 17);

  let altitudeFt: number | undefined;
  let groundSpeedKt: number | undefined;
  let trueTrackDeg: number | undefined;

  if (isSurface) {
    // Surface messages replace the airborne altitude field (bits 8-19)
    // with movement (bits 5-11) and track (bits 12-19) - a different
    // field layout, not just a different interpretation of the same bits.
    const movementField = extractBits(me, 5, 7);
    const trackStatus = extractBits(me, 12, 1);
    const trackRaw = extractBits(me, 13, 7);
    groundSpeedKt = decodeSurfaceMovement(movementField);
    trueTrackDeg = trackStatus === 1 ? (trackRaw * 360) / 128 : undefined;
  } else {
    const altitudeField = extractBits(me, 8, 12);
    altitudeFt =
      category === 'airborneBaroPosition'
        ? decodeAdsbPositionAltitude(altitudeField)
        : decodeAdsbGnssAltitude(altitudeField);
  }

  return {
    kind: 'extendedSquitterPosition',
    icaoHex,
    surface: isSurface,
    cprFormat,
    latCpr,
    lonCpr,
    altitudeFt,
    groundSpeedKt,
    trueTrackDeg,
  };
}

function decodeExtendedSquitter(bytes: Uint8Array, icaoHex: string): DecodedModeSMessage | undefined {
  const me = bytes.slice(4, 11);
  const typeCode = extractBits(me, 0, 5);
  const category = categorizeTypeCode(typeCode);

  switch (category) {
    case 'identification':
      return { kind: 'extendedSquitterIdentification', icaoHex, identification: decodeIdentification(me) };

    case 'velocity': {
      const velocity = decodeAirborneVelocity(me);
      return velocity === undefined ? undefined : { kind: 'extendedSquitterVelocity', icaoHex, velocity };
    }

    case 'emergencyStatus': {
      const subtype = extractBits(me, 5, 3);
      if (subtype !== 1) {
        // Subtype 2 (TCAS/ACAS resolution advisory broadcast) is a
        // different domain - collision-avoidance coordination, not
        // aircraft state - and is not decoded, the same as DF0/DF16.
        return undefined;
      }
      const emergencyState = decodeEmergencyState(extractBits(me, 8, 3));
      const idField = extractBits(me, 11, 13);
      return {
        kind: 'extendedSquitterEmergencyStatus',
        icaoHex,
        emergencyState,
        squawk: decodeIdentityCode(idField),
      };
    }

    case 'surfacePosition':
    case 'airborneBaroPosition':
    case 'airborneGnssPosition':
      return decodePositionMessage(me, icaoHex, category);

    default:
      return undefined;
  }
}

/**
 * Decodes a raw Mode-S message into its typed, discriminated result.
 *
 * DF17/18 (extended squitter) messages are only decoded when their CRC is
 * exactly zero - a non-zero CRC on a squitter means the message was
 * corrupted in transit, and this package would rather report "not
 * decodable" than return plausible-looking but wrong data. DF24 (Comm-D)
 * is recognized but not decoded - see {@link DecodedModeSMessage}.
 *
 * ```typescript
 * import { decodeModeSMessage } from '@squawk/mode-s';
 *
 * const decoded = decodeModeSMessage(rawMessageBytes);
 * if (decoded?.kind === 'extendedSquitterPosition') {
 *   console.log(decoded.icaoHex, decoded.latCpr, decoded.lonCpr);
 * }
 * ```
 *
 * @param bytes - Raw message bytes (7 or 14 bytes).
 * @returns The decoded message, or undefined if the downlink format is unrecognized, not decoded by this package, or the message fails its CRC check.
 */
export function decodeModeSMessage(bytes: Uint8Array): DecodedModeSMessage | undefined {
  const envelope = parseModeSFrame(bytes);

  if (envelope.downlinkFormat === 17 || envelope.downlinkFormat === 18) {
    if (envelope.crcRemainder !== 0) {
      return undefined;
    }
    return decodeExtendedSquitter(bytes, hexAddress(bytes, 1));
  }

  if (envelope.downlinkFormat === 11) {
    if (envelope.crcRemainder > MAX_PLAUSIBLE_INTERROGATOR_CODE) {
      return undefined;
    }
    return { kind: 'allCallReply', icaoHex: hexAddress(bytes, 1) };
  }

  if (envelope.downlinkFormat === 4 || envelope.downlinkFormat === 20) {
    const acField = extractBits(bytes, 19, 13);
    return {
      kind: 'surveillanceAltitudeReply',
      candidateIcaoHex: crcToHexAddress(envelope.crcRemainder),
      altitudeFt: decodeAltitudeCode(acField),
    };
  }

  if (envelope.downlinkFormat === 5 || envelope.downlinkFormat === 21) {
    const idField = extractBits(bytes, 19, 13);
    return {
      kind: 'surveillanceIdentityReply',
      candidateIcaoHex: crcToHexAddress(envelope.crcRemainder),
      squawk: decodeIdentityCode(idField),
    };
  }

  return undefined;
}
