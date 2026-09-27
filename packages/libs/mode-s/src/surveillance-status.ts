import type { SurveillanceStatus } from './types/index.js';

/** 2-bit Surveillance Status subfield values, per RTCA DO-260B. */
const SURVEILLANCE_STATUSES: readonly SurveillanceStatus[] = [
  'none',
  'permanentAlert',
  'temporaryAlert',
  'ident',
];

/**
 * Decodes the 2-bit Surveillance Status (SS) subfield of an ADS-B airborne
 * position message (type codes 0, 9-18, and 20-22).
 *
 * @param rawStatus - The raw 2-bit field, 0-3.
 * @returns The decoded status, or undefined for a value outside 0-3, which a 2-bit field cannot hold.
 */
export function decodeSurveillanceStatus(rawStatus: number): SurveillanceStatus | undefined {
  return SURVEILLANCE_STATUSES[rawStatus];
}
