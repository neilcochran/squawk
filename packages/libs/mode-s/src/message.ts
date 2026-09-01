import { decodeAcasResolutionAdvisory } from './acas.js';
import {
  decodeAdsbGnssAltitude,
  decodeAdsbPositionAltitude,
  decodeAltitudeCode,
} from './altitude.js';
import { extractBits, formatHexAddress } from './bits.js';
import { decodeEmergencyState } from './emergency-status.js';
import { parseModeSFrame } from './frame.js';
import { decodeIdentification } from './identification.js';
import { decodeIdentityCode } from './identity.js';
import { decodeSurfaceMovement } from './surface-movement.js';
import type {
  DecodedModeSMessage,
  ExtendedSquitterPosition,
  MessageSource,
} from './types/index.js';
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
  | 'aircraftStatus';

const TYPE_CODE_CATEGORIES: readonly { min: number; max: number; category: TypeCodeCategory }[] = [
  { min: 0, max: 0, category: 'airborneBaroPosition' },
  { min: 1, max: 4, category: 'identification' },
  { min: 5, max: 8, category: 'surfacePosition' },
  { min: 9, max: 18, category: 'airborneBaroPosition' },
  { min: 19, max: 19, category: 'velocity' },
  { min: 20, max: 22, category: 'airborneGnssPosition' },
  { min: 28, max: 28, category: 'aircraftStatus' },
];

function categorizeTypeCode(typeCode: number): TypeCodeCategory | undefined {
  return TYPE_CODE_CATEGORIES.find(({ min, max }) => typeCode >= min && typeCode <= max)?.category;
}

/**
 * Maps a DF18 control-field (CF) value to the {@link MessageSource} it
 * denotes - the single source of truth for both which CF values this
 * package decodes (those with a defined case below) and what they mean.
 * CF=3 (TIS-B, coarse format) uses a materially different field layout
 * this package does not decode; CF=4 (TIS-B management) and CF=7
 * (reserved) carry no per-aircraft state to decode - both fall through
 * to `undefined`, same as an unrecognized value.
 */
function messageSourceForControlField(controlField: number): MessageSource | undefined {
  switch (controlField) {
    case 0:
      return 'icaoDirect';
    case 1:
      return 'anonymousDirect';
    case 2:
      return 'icaoTisb';
    case 5:
      return 'anonymousTisb';
    case 6:
      return 'adsr';
    default:
      return undefined;
  }
}

function hexAddress(bytes: Uint8Array, byteOffset: number): string {
  return formatHexAddress(extractBits(bytes, byteOffset * 8, 24));
}

/** Decodes the fields shared by DF0 and DF16 (both ACAS/TCAS air-air surveillance replies): recovered address, on-ground status, and altitude. DF16 additionally carries a Resolution Advisory report on top of this. */
function decodeAirAirSurveillanceCore(
  bytes: Uint8Array,
  crcRemainder: number,
): { candidateIcaoHex: string; surface: boolean; altitudeFt: number | undefined } {
  const acField = extractBits(bytes, 19, 13);
  return {
    candidateIcaoHex: formatHexAddress(crcRemainder),
    surface: extractBits(bytes, 5, 1) === 1,
    altitudeFt: decodeAltitudeCode(acField),
  };
}

/**
 * Decodes the three position-carrying categories (surface, airborne baro,
 * airborne GNSS) - identical CPR field layout, differing only in what
 * replaces the altitude bits for a surface message. Type code 0 (airborne,
 * no position information) shares `airborneBaroPosition`'s altitude-field
 * layout, but its CPR fields are defined as unavailable rather than a real
 * encoded position, so `hasPosition` lets the caller omit them rather than
 * exposing plausible-looking-but-meaningless bits.
 */
function decodePositionMessage(
  me: Uint8Array,
  icaoHex: string,
  messageSource: MessageSource,
  hasPosition: boolean,
  category: 'surfacePosition' | 'airborneBaroPosition' | 'airborneGnssPosition',
): ExtendedSquitterPosition {
  const isSurface = category === 'surfacePosition';
  const cprFormat = extractBits(me, 21, 1) === 1 ? 'odd' : 'even';
  const latCpr = hasPosition ? extractBits(me, 22, 17) : undefined;
  const lonCpr = hasPosition ? extractBits(me, 39, 17) : undefined;

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
    messageSource,
    surface: isSurface,
    cprFormat,
    latCpr,
    lonCpr,
    altitudeFt,
    groundSpeedKt,
    trueTrackDeg,
  };
}

function decodeExtendedSquitter(
  bytes: Uint8Array,
  icaoHex: string,
  messageSource: MessageSource,
): DecodedModeSMessage | undefined {
  const me = bytes.slice(4, 11);
  const typeCode = extractBits(me, 0, 5);
  const category = categorizeTypeCode(typeCode);

  switch (category) {
    case 'identification':
      return {
        kind: 'extendedSquitterIdentification',
        icaoHex,
        messageSource,
        identification: decodeIdentification(me),
      };

    case 'velocity': {
      const velocity = decodeAirborneVelocity(me);
      return velocity === undefined
        ? undefined
        : { kind: 'extendedSquitterVelocity', icaoHex, messageSource, velocity };
    }

    case 'aircraftStatus': {
      const subtype = extractBits(me, 5, 3);
      if (subtype === 1) {
        const emergencyState = decodeEmergencyState(extractBits(me, 8, 3));
        const idField = extractBits(me, 11, 13);
        return {
          kind: 'extendedSquitterEmergencyStatus',
          icaoHex,
          messageSource,
          emergencyState,
          squawk: decodeIdentityCode(idField),
        };
      }
      if (subtype === 2) {
        const resolutionAdvisory = decodeAcasResolutionAdvisory(me);
        return resolutionAdvisory === undefined
          ? undefined
          : { kind: 'extendedSquitterAcasRaBroadcast', icaoHex, messageSource, resolutionAdvisory };
      }
      return undefined;
    }

    case 'surfacePosition':
    case 'airborneBaroPosition':
    case 'airborneGnssPosition':
      return decodePositionMessage(me, icaoHex, messageSource, typeCode !== 0, category);

    default:
      return undefined;
  }
}

/**
 * Decodes a raw Mode-S message into its typed, discriminated result.
 *
 * A downlink format value of 16 or higher always denotes a 112-bit (14
 * byte) long message; below 16 always denotes a 56-bit (7 byte) short
 * message - this holds for every downlink format, decoded or not. Any
 * `bytes` whose length does not match what its own downlink format implies
 * is rejected before further decoding, since a mismatch means the buffer is
 * truncated or corrupted (e.g. a bit-flipped DF field misreading a short
 * reply as a long one) rather than a genuine message of that format.
 *
 * DF17/18 (extended squitter) messages are only decoded when their CRC is
 * exactly zero - a non-zero CRC on a squitter means the message was
 * corrupted in transit, and this package would rather report "not
 * decodable" than return plausible-looking but wrong data. DF18 messages
 * are further gated on the control field: only CF=0/1/2/5/6 (which share
 * DF17's type-code-coded ME layout) are decoded - see {@link MessageSource},
 * which every decoded DF17/18 message carries so callers can tell a real,
 * direct ICAO address from an anonymous or ground-derived one rather than
 * losing that distinction after the gate. DF24 (Comm-D) is recognized
 * but not decoded - see {@link DecodedModeSMessage}. DF19 (military
 * extended squitter) and DF22 (military use) are reserved formats with no
 * publicly documented payload and are not decoded, for the same reason as
 * DF24.
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
 * @returns The decoded message, or undefined if `bytes`' length does not match its downlink format, the downlink format is unrecognized, not decoded by this package, or the message fails its CRC check.
 */
export function decodeModeSMessage(bytes: Uint8Array): DecodedModeSMessage | undefined {
  const envelope = parseModeSFrame(bytes);
  const expectedLength = envelope.downlinkFormat >= 16 ? 14 : 7;
  if (bytes.length !== expectedLength) {
    return undefined;
  }

  if (envelope.downlinkFormat === 17 || envelope.downlinkFormat === 18) {
    if (envelope.crcRemainder !== 0) {
      return undefined;
    }
    // DF17 carries no control field - a DF17 transponder is always
    // ICAO-addressed and transmitting its own state directly, by protocol
    // definition, so this is a fixed value rather than a decoded one.
    const messageSource: MessageSource | undefined =
      envelope.downlinkFormat === 17
        ? 'icaoDirect'
        : messageSourceForControlField(extractBits(bytes, 5, 3));
    if (messageSource === undefined) {
      return undefined;
    }
    return decodeExtendedSquitter(bytes, hexAddress(bytes, 1), messageSource);
  }

  if (envelope.downlinkFormat === 11) {
    if (envelope.crcRemainder > MAX_PLAUSIBLE_INTERROGATOR_CODE) {
      return undefined;
    }
    return { kind: 'allCallReply', icaoHex: hexAddress(bytes, 1) };
  }

  if (envelope.downlinkFormat === 0) {
    return {
      kind: 'shortAirAirSurveillanceReply',
      ...decodeAirAirSurveillanceCore(bytes, envelope.crcRemainder),
    };
  }

  if (envelope.downlinkFormat === 16) {
    return {
      kind: 'longAirAirSurveillanceReply',
      ...decodeAirAirSurveillanceCore(bytes, envelope.crcRemainder),
      resolutionAdvisory: decodeAcasResolutionAdvisory(bytes.slice(4, 11)),
    };
  }

  if (envelope.downlinkFormat === 4 || envelope.downlinkFormat === 20) {
    const acField = extractBits(bytes, 19, 13);
    return {
      kind: 'surveillanceAltitudeReply',
      candidateIcaoHex: formatHexAddress(envelope.crcRemainder),
      altitudeFt: decodeAltitudeCode(acField),
    };
  }

  if (envelope.downlinkFormat === 5 || envelope.downlinkFormat === 21) {
    const idField = extractBits(bytes, 19, 13);
    return {
      kind: 'surveillanceIdentityReply',
      candidateIcaoHex: formatHexAddress(envelope.crcRemainder),
      squawk: decodeIdentityCode(idField),
    };
  }

  return undefined;
}
