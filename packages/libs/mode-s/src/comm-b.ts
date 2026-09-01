import { extractBits } from './bits.js';
import type {
  CommBRegister,
  HeadingAndSpeedReport,
  SelectedVerticalIntention,
  TrackAndTurnReport,
} from './types/index.js';

/**
 * Combines an unsigned magnitude and a separate sign bit into a signed
 * value. Mode-S encodes sign and magnitude as separate bit fields (not
 * two's complement) - sign=1, magnitude=0 represents `-2**width`, not `-0`.
 */
function signed(value: number, width: number, sign: number): number {
  return sign === 1 ? value - (1 << width) : value;
}

/** Wraps an angle into the half-open interval [0, 360) - JavaScript's `%` follows the dividend's sign for negative input, unlike the floor-mod this needs. */
function normalizeAngleDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Returns true if a status-gated value field is inconsistent: BDS registers
 * with status-bit gates encode each field as a status bit followed by a
 * fixed-width value, and when the status is 0 the entire value field
 * (including any sign bit) must also be 0. A nonzero value with status=0
 * indicates either a corrupt message or a different BDS register's payload
 * accidentally passing this one's checks.
 */
function wrongStatus(
  mb: Uint8Array,
  statusBit: number,
  valueStart: number,
  valueWidth: number,
): boolean {
  if (extractBits(mb, statusBit, 1) !== 0) {
    return false;
  }
  return extractBits(mb, valueStart, valueWidth) !== 0;
}

function decodeTargetAltitudeSource(
  raw: number,
): 'unknown' | 'aircraftAltitude' | 'mcpFcu' | 'fms' {
  switch (raw) {
    case 1:
      return 'aircraftAltitude';
    case 2:
      return 'mcpFcu';
    case 3:
      return 'fms';
    default:
      return 'unknown';
  }
}

/** Whether `mb` is a structurally plausible BDS 4,0 (Selected Vertical Intention) register - status-bit/value consistency and reserved-bits-must-be-zero checks. Has no format-identifier byte, so this is a heuristic, not a certainty. */
function isSelectedVerticalIntention(mb: Uint8Array): boolean {
  if (mb.every((byte) => byte === 0)) {
    return false;
  }
  if (wrongStatus(mb, 0, 1, 12)) {
    return false;
  }
  if (wrongStatus(mb, 13, 14, 12)) {
    return false;
  }
  if (wrongStatus(mb, 26, 27, 12)) {
    return false;
  }
  if (wrongStatus(mb, 47, 48, 3)) {
    return false;
  }
  if (wrongStatus(mb, 53, 54, 2)) {
    return false;
  }
  if (extractBits(mb, 39, 8) !== 0) {
    return false;
  }
  return extractBits(mb, 51, 2) === 0;
}

/**
 * Decodes a BDS 4,0 (Selected Vertical Intention) register.
 *
 * @param mb - The 7-byte MB field of a DF20/21 Comm-B reply, already known (or inferred via {@link inferCommBRegisters}) to be BDS 4,0.
 * @returns The decoded selected vertical intention.
 */
export function decodeSelectedVerticalIntention(mb: Uint8Array): SelectedVerticalIntention {
  const mcpStatus = extractBits(mb, 0, 1);
  const fmsStatus = extractBits(mb, 13, 1);
  const baroStatus = extractBits(mb, 26, 1);
  const modeStatus = extractBits(mb, 47, 1);
  const sourceStatus = extractBits(mb, 53, 1);

  return {
    bdsCode: '4,0',
    mcpFcuSelectedAltitudeFt: mcpStatus === 1 ? extractBits(mb, 1, 12) * 16 : undefined,
    fmsSelectedAltitudeFt: fmsStatus === 1 ? extractBits(mb, 14, 12) * 16 : undefined,
    baroPressureSettingMb: baroStatus === 1 ? extractBits(mb, 27, 12) * 0.1 + 800 : undefined,
    vnavModeActive: modeStatus === 1 ? extractBits(mb, 48, 1) === 1 : undefined,
    altitudeHoldModeActive: modeStatus === 1 ? extractBits(mb, 49, 1) === 1 : undefined,
    approachModeActive: modeStatus === 1 ? extractBits(mb, 50, 1) === 1 : undefined,
    targetAltitudeSource:
      sourceStatus === 1 ? decodeTargetAltitudeSource(extractBits(mb, 54, 2)) : undefined,
  };
}

/** Whether `mb` is a structurally plausible BDS 5,0 (Track and Turn Report) register - status-bit consistency plus physically-plausible range checks (e.g. |roll| <= 35deg). Has no format-identifier byte, so this is a heuristic, not a certainty - a payload can pass both this and {@link isHeadingAndSpeedReport}. */
function isTrackAndTurnReport(mb: Uint8Array): boolean {
  if (mb.every((byte) => byte === 0)) {
    return false;
  }
  if (wrongStatus(mb, 0, 1, 10)) {
    return false;
  }
  if (wrongStatus(mb, 11, 12, 11)) {
    return false;
  }
  if (wrongStatus(mb, 23, 24, 10)) {
    return false;
  }
  if (wrongStatus(mb, 34, 35, 10)) {
    return false;
  }
  if (wrongStatus(mb, 45, 46, 10)) {
    return false;
  }

  if (extractBits(mb, 0, 1) === 1) {
    const rollDeg = (signed(extractBits(mb, 2, 9), 9, extractBits(mb, 1, 1)) * 45) / 256;
    if (Math.abs(rollDeg) > 35) {
      return false;
    }
  }

  const gsStatus = extractBits(mb, 23, 1);
  const gsRaw = extractBits(mb, 24, 10);
  if (gsStatus === 1 && gsRaw * 2 > 600) {
    return false;
  }

  const tasStatus = extractBits(mb, 45, 1);
  const tasRaw = extractBits(mb, 46, 10);
  if (tasStatus === 1 && tasRaw * 2 > 600) {
    return false;
  }

  return !(gsStatus === 1 && tasStatus === 1 && Math.abs(tasRaw * 2 - gsRaw * 2) > 200);
}

/**
 * Decodes a BDS 5,0 (Track and Turn Report) register.
 *
 * @param mb - The 7-byte MB field of a DF20/21 Comm-B reply, already known (or inferred via {@link inferCommBRegisters}) to be BDS 5,0.
 * @returns The decoded track and turn report.
 */
export function decodeTrackAndTurnReport(mb: Uint8Array): TrackAndTurnReport {
  const rollStatus = extractBits(mb, 0, 1);
  const trackStatus = extractBits(mb, 11, 1);
  const gsStatus = extractBits(mb, 23, 1);
  const trackRateStatus = extractBits(mb, 34, 1);
  const tasStatus = extractBits(mb, 45, 1);

  return {
    bdsCode: '5,0',
    rollAngleDeg:
      rollStatus === 1
        ? (signed(extractBits(mb, 2, 9), 9, extractBits(mb, 1, 1)) * 45) / 256
        : undefined,
    trueTrackDeg:
      trackStatus === 1
        ? normalizeAngleDeg(
            (signed(extractBits(mb, 13, 10), 10, extractBits(mb, 12, 1)) * 90) / 512,
          )
        : undefined,
    groundSpeedKt: gsStatus === 1 ? extractBits(mb, 24, 10) * 2 : undefined,
    trackAngleRateDegPerSec:
      trackRateStatus === 1
        ? (signed(extractBits(mb, 36, 9), 9, extractBits(mb, 35, 1)) * 8) / 256
        : undefined,
    trueAirspeedKt: tasStatus === 1 ? extractBits(mb, 46, 10) * 2 : undefined,
  };
}

/** Whether `mb` is a structurally plausible BDS 6,0 (Heading and Speed Report) register - status-bit consistency plus physically-plausible range checks (e.g. Mach <= 1). Has no format-identifier byte, so this is a heuristic, not a certainty - a payload can pass both this and {@link isTrackAndTurnReport}. */
function isHeadingAndSpeedReport(mb: Uint8Array): boolean {
  if (mb.every((byte) => byte === 0)) {
    return false;
  }
  if (wrongStatus(mb, 0, 1, 11)) {
    return false;
  }
  if (wrongStatus(mb, 12, 13, 10)) {
    return false;
  }
  if (wrongStatus(mb, 23, 24, 10)) {
    return false;
  }
  if (wrongStatus(mb, 34, 35, 10)) {
    return false;
  }
  if (wrongStatus(mb, 45, 46, 10)) {
    return false;
  }

  const iasStatus = extractBits(mb, 12, 1);
  if (iasStatus === 1 && extractBits(mb, 13, 10) > 500) {
    return false;
  }

  const machStatus = extractBits(mb, 23, 1);
  if (machStatus === 1 && (extractBits(mb, 24, 10) * 2.048) / 512 > 1) {
    return false;
  }

  const vrbStatus = extractBits(mb, 34, 1);
  if (vrbStatus === 1) {
    const vrb = signed(extractBits(mb, 36, 9), 9, extractBits(mb, 35, 1)) * 32;
    if (Math.abs(vrb) > 6000) {
      return false;
    }
  }

  const vriStatus = extractBits(mb, 45, 1);
  if (vriStatus === 1) {
    const vri = signed(extractBits(mb, 47, 9), 9, extractBits(mb, 46, 1)) * 32;
    if (Math.abs(vri) > 6000) {
      return false;
    }
  }

  return true;
}

/**
 * Decodes a BDS 6,0 (Heading and Speed Report) register.
 *
 * @param mb - The 7-byte MB field of a DF20/21 Comm-B reply, already known (or inferred via {@link inferCommBRegisters}) to be BDS 6,0.
 * @returns The decoded heading and speed report.
 */
export function decodeHeadingAndSpeedReport(mb: Uint8Array): HeadingAndSpeedReport {
  const headingStatus = extractBits(mb, 0, 1);
  const iasStatus = extractBits(mb, 12, 1);
  const machStatus = extractBits(mb, 23, 1);
  const vrbStatus = extractBits(mb, 34, 1);
  const vriStatus = extractBits(mb, 45, 1);

  return {
    bdsCode: '6,0',
    magneticHeadingDeg:
      headingStatus === 1
        ? normalizeAngleDeg((signed(extractBits(mb, 2, 10), 10, extractBits(mb, 1, 1)) * 90) / 512)
        : undefined,
    indicatedAirspeedKt: iasStatus === 1 ? extractBits(mb, 13, 10) : undefined,
    mach: machStatus === 1 ? (extractBits(mb, 24, 10) * 2.048) / 512 : undefined,
    baroVerticalRateFtPerMin:
      vrbStatus === 1 ? signed(extractBits(mb, 36, 9), 9, extractBits(mb, 35, 1)) * 32 : undefined,
    inertialVerticalRateFtPerMin:
      vriStatus === 1 ? signed(extractBits(mb, 47, 9), 9, extractBits(mb, 46, 1)) * 32 : undefined,
  };
}

/**
 * Infers which "Enhanced Surveillance" Comm-B register(s) a DF20/21 MB
 * field plausibly holds, and decodes each. Unlike DF17/18's type-code-coded
 * ME field, a Comm-B MB field carries no self-declared register identifier
 * for BDS 4,0/5,0/6,0 - this package would rather report every plausible
 * candidate (via structural and range validation, matching pyModeS's own
 * approach to this exact ambiguity) than silently guess a single wrong
 * answer. In practice this is usually unambiguous; BDS 5,0 and 6,0 are the
 * pair most likely to both pass validation for the same bytes.
 *
 * @param mb - The 7-byte MB field of a DF20/21 Comm-B reply.
 * @returns Every register this MB field plausibly holds - empty if none, one if unambiguous, more than one if genuinely ambiguous.
 */
export function inferCommBRegisters(mb: Uint8Array): CommBRegister[] {
  const candidates: CommBRegister[] = [];
  if (isSelectedVerticalIntention(mb)) {
    candidates.push(decodeSelectedVerticalIntention(mb));
  }
  if (isTrackAndTurnReport(mb)) {
    candidates.push(decodeTrackAndTurnReport(mb));
  }
  if (isHeadingAndSpeedReport(mb)) {
    candidates.push(decodeHeadingAndSpeedReport(mb));
  }
  return candidates;
}
