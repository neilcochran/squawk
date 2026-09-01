import type { Position } from '@squawk/types';

/**
 * Raw 17-bit CPR-encoded position fields, as carried by an ADS-B airborne or
 * surface position message. Each field is a raw integer in [0, 131071].
 *
 * `ExtendedSquitterPosition.latCpr`/`lonCpr` (from `decodeModeSMessage`) are
 * `number | undefined` - undefined for a type-code-0 message, which has no
 * position fix to encode. Check for that case before constructing a
 * `CprPosition` from a decoded message; the two types are otherwise
 * structurally identical.
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
