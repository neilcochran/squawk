import type { Position } from '@squawk/types';

/**
 * Raw 17-bit CPR-encoded position fields, as carried by an ADS-B airborne or
 * surface position message. Each field is a raw integer in [0, 131071].
 */
export interface CprPosition {
  /** Raw 17-bit CPR-encoded latitude field. */
  latCpr: number;
  /** Raw 17-bit CPR-encoded longitude field. */
  lonCpr: number;
}

/**
 * A reference position used to disambiguate a single CPR-encoded frame that
 * has no paired opposite-format frame to decode globally against. Must be
 * within roughly 180 NM of the true position for airborne decode, or 45 NM
 * for surface decode - the caller is responsible for that precondition.
 */
export type CprReference = Pick<Position, 'lat' | 'lon'>;
