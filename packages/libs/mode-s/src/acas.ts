import { decodeAltitudeCode } from './altitude.js';
import { extractBits, formatHexAddress } from './bits.js';
import type {
  AcasResolutionAdvisoryReport,
  AcasThreat,
  ResolutionAdvisoryType,
} from './types/index.js';

/** Reserved Threat Type Indicator value - not a legitimate report. */
const TTI_RESERVED = 3;

/** Decodes the threat-identity data (bits 28-55) per the Threat Type Indicator, `threatTypeIndicator`. */
function decodeThreat(payload: Uint8Array, threatTypeIndicator: number): AcasThreat {
  if (threatTypeIndicator === 1) {
    return {
      threatType: 'icaoAddress',
      threatIcaoHex: formatHexAddress(extractBits(payload, 30, 24)),
    };
  }
  if (threatTypeIndicator === 2) {
    const rangeRaw = extractBits(payload, 43, 7);
    const bearingRaw = extractBits(payload, 50, 6);
    return {
      threatType: 'altitudeRangeBearing',
      threatAltitudeFt: decodeAltitudeCode(extractBits(payload, 30, 13)),
      threatRangeNm: rangeRaw > 0 ? (rangeRaw - 1) / 10 : undefined,
      threatBearingDeg: bearingRaw > 0 ? 6 * (bearingRaw - 1) + 3 : undefined,
    };
  }
  return { threatType: 'none' };
}

function decodeAdvisoryType(
  active: boolean,
  corrective: boolean,
  downwardSense: boolean,
  increasedRate: boolean,
  senseReversal: boolean,
  altitudeCrossing: boolean,
  positive: boolean,
): ResolutionAdvisoryType | undefined {
  if (!active) {
    return undefined;
  }
  if (!corrective) {
    // Preventive: DO-185B defines no positive-preventive RA type.
    if (positive) {
      return undefined;
    }
    return downwardSense ? 'doNotClimb' : 'doNotDescend';
  }
  if (senseReversal) {
    return downwardSense ? 'reversalToDescend' : 'reversalToClimb';
  }
  if (increasedRate) {
    return downwardSense ? 'increaseDescent' : 'increaseClimb';
  }
  if (!positive) {
    return downwardSense ? 'reduceClimb' : 'reduceDescent';
  }
  if (downwardSense) {
    return altitudeCrossing ? 'crossingDescend' : 'descend';
  }
  return altitudeCrossing ? 'crossingClimb' : 'climb';
}

/**
 * Decodes an ACAS/TCAS Resolution Advisory report (BDS 3,0 content), shared
 * by DF16's MV field and a DF17/18 type-code-28 subtype-2 ME field - both
 * carry the same 48 bits of content starting at bit 8 of the 7-byte buffer
 * (DF16's MV reserves its first byte for a register-identifier convention;
 * TC28/ST2's ME uses that same first byte for its type-code-and-subtype
 * header instead - either way, content starts at bit 8).
 *
 * This function assumes `payload` is already known to carry a genuine BDS
 * 3,0 report - it does not itself check DF16's register-identifier byte,
 * since a TC28/ST2 caller's first byte is never that identifier by
 * construction. A DF16 caller must check that byte itself before calling
 * this (see `decodeModeSMessage`'s DF16 branch) - DF16's MV is a
 * general-purpose Comm-B register slot that can legitimately carry a
 * different register, unlike TC28/ST2 which is gated by its own type-code
 * and subtype instead.
 *
 * @param payload - The 7-byte field: DF16's MV, or a type-code-28 subtype-2 ME.
 * @returns The decoded report, or undefined if the Threat Type Indicator is the reserved value (not a legitimate report).
 */
export function decodeAcasResolutionAdvisory(
  payload: Uint8Array,
): AcasResolutionAdvisoryReport | undefined {
  const threatTypeIndicator = extractBits(payload, 28, 2);
  if (threatTypeIndicator === TTI_RESERVED) {
    return undefined;
  }

  const active = extractBits(payload, 8, 1) === 1;
  const corrective = extractBits(payload, 9, 1) === 1;
  const downwardSense = extractBits(payload, 10, 1) === 1;
  const increasedRate = extractBits(payload, 11, 1) === 1;
  const senseReversal = extractBits(payload, 12, 1) === 1;
  const altitudeCrossing = extractBits(payload, 13, 1) === 1;
  const positive = extractBits(payload, 14, 1) === 1;

  return {
    active,
    advisoryType: decodeAdvisoryType(
      active,
      corrective,
      downwardSense,
      increasedRate,
      senseReversal,
      altitudeCrossing,
      positive,
    ),
    corrective,
    downwardSense,
    increasedRate,
    senseReversal,
    altitudeCrossing,
    positive,
    doNotPassBelow: extractBits(payload, 22, 1) === 1,
    doNotPassAbove: extractBits(payload, 23, 1) === 1,
    doNotTurnLeft: extractBits(payload, 24, 1) === 1,
    doNotTurnRight: extractBits(payload, 25, 1) === 1,
    terminated: extractBits(payload, 26, 1) === 1,
    multipleThreat: extractBits(payload, 27, 1) === 1,
    threat: decodeThreat(payload, threatTypeIndicator),
  };
}
