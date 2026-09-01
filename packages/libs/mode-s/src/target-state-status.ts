import { extractBits } from './bits.js';
import type { TargetStateAndStatus } from './types/index.js';

/**
 * Decodes an ADS-B Target State and Status message (BDS 6,2, type code 29).
 *
 * @param me - The 7-byte ME field of a DF17/18 message whose type code is 29.
 * @returns The decoded target state and status.
 */
export function decodeTargetStateAndStatus(me: Uint8Array): TargetStateAndStatus {
  const altitudeSourceBit = extractBits(me, 8, 1);
  const altitudeRaw = extractBits(me, 9, 11);
  const selectedAltitudeFt = altitudeRaw === 0 ? undefined : (altitudeRaw - 1) * 32;
  const selectedAltitudeSource =
    altitudeRaw === 0 ? undefined : altitudeSourceBit === 1 ? 'fms' : 'mcpFcu';

  const baroRaw = extractBits(me, 20, 9);
  const baroPressureSettingMb = baroRaw === 0 ? undefined : 800 + (baroRaw - 1) * 0.8;

  const headingStatus = extractBits(me, 29, 1);
  const headingRaw = extractBits(me, 30, 9);
  const selectedHeadingDeg = headingStatus === 1 ? (headingRaw * 360) / 512 : undefined;

  const modeStatus = extractBits(me, 46, 1);

  return {
    selectedAltitudeSource,
    selectedAltitudeFt,
    baroPressureSettingMb,
    selectedHeadingDeg,
    navAccuracyCategoryPosition: extractBits(me, 39, 4),
    nicBaro: extractBits(me, 43, 1) === 1,
    sourceIntegrityLevel: extractBits(me, 44, 2),
    autopilotEngaged: modeStatus === 1 ? extractBits(me, 47, 1) === 1 : undefined,
    vnavModeActive: modeStatus === 1 ? extractBits(me, 48, 1) === 1 : undefined,
    altitudeHoldModeActive: modeStatus === 1 ? extractBits(me, 49, 1) === 1 : undefined,
    approachModeActive: modeStatus === 1 ? extractBits(me, 51, 1) === 1 : undefined,
    lnavModeActive: modeStatus === 1 ? extractBits(me, 53, 1) === 1 : undefined,
    tcasOperational: extractBits(me, 52, 1) === 1,
  };
}
