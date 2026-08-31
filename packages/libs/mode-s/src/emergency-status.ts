import type { EmergencyState } from './types/index.js';

/** 3-bit emergency state field values, per ICAO Annex 10 Vol. IV / RTCA DO-260. */
const EMERGENCY_STATES: readonly EmergencyState[] = [
  'none',
  'general',
  'lifeguardMedical',
  'minimumFuel',
  'noCommunications',
  'unlawfulInterference',
  'downed',
  'reserved',
];

/**
 * Decodes the 3-bit emergency state field of an ADS-B aircraft status
 * message (BDS 6,1 subtype 1, type code 28).
 *
 * @param rawState - The raw 3-bit field, 0-7.
 * @returns The decoded emergency state.
 */
export function decodeEmergencyState(rawState: number): EmergencyState {
  return EMERGENCY_STATES[rawState] ?? 'reserved';
}
