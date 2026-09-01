import { extractBits } from './bits.js';
import type { AircraftOperationalStatus } from './types/index.js';

/**
 * Decodes an ADS-B Aircraft Operational Status message (BDS 6,5, type code 31).
 *
 * @param me - The 7-byte ME field of a DF17/18 message whose type code is 31.
 * @returns The decoded operational status.
 */
export function decodeAircraftOperationalStatus(me: Uint8Array): AircraftOperationalStatus {
  const surface = extractBits(me, 5, 3) === 1;
  const adsbVersion = extractBits(me, 40, 3);

  return {
    surface,
    adsbVersion,
    capabilityClassCode: extractBits(me, 8, 16),
    operationalModeCode: extractBits(me, 24, 16),
    nicSupplementA: extractBits(me, 43, 1) === 1,
    navAccuracyCategoryPosition: extractBits(me, 44, 4),
    sourceIntegrityLevel: extractBits(me, 50, 2),
    nicBaro: !surface && adsbVersion >= 1 ? extractBits(me, 52, 1) === 1 : undefined,
    headingReference: extractBits(me, 53, 1) === 1 ? 'magnetic' : 'true',
    silSupplementPerHour: adsbVersion === 2 ? extractBits(me, 54, 1) === 1 : undefined,
  };
}
