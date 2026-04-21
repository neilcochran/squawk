import type { ApproachType } from '@squawk/types';

/**
 * Maps the CIFP Route Type letter (ARINC 424 field 5.7) to an
 * {@link ApproachType}. The route type is taken from the final-approach
 * leg records of an IAP (that is, records whose route type is neither
 * `A` - Approach Transition - nor `Z` - Missed Approach).
 */
const ROUTE_TYPE_TO_APPROACH_TYPE: Readonly<Record<string, ApproachType>> = {
  I: 'ILS',
  L: 'LOC',
  B: 'LOC_BC',
  R: 'RNAV',
  H: 'RNAV_RNP',
  V: 'VOR',
  D: 'VOR_DME',
  S: 'VOR',
  N: 'NDB',
  Q: 'NDB_DME',
  T: 'TACAN',
  J: 'GLS',
  G: 'IGS',
  X: 'LDA',
  U: 'SDF',
  P: 'GPS',
  F: 'FMS',
  M: 'MLS',
  W: 'MLS',
  Y: 'MLS',
};

/**
 * Maps a CIFP approach-record Route Type letter to the corresponding
 * {@link ApproachType}. Returns `undefined` when the letter is not a
 * recognized approach route type (for example `A` for a transition or
 * `Z` for a missed approach segment).
 *
 * @param routeType - Single-character route type letter from the approach record.
 */
export function approachTypeFromRouteType(routeType: string): ApproachType | undefined {
  if (routeType.length !== 1) {
    return undefined;
  }
  return ROUTE_TYPE_TO_APPROACH_TYPE[routeType];
}

/**
 * Pattern matching the runway-specific portion of a CIFP approach
 * identifier: two digits followed by an optional `L` / `R` / `C`
 * sidedness indicator.
 */
const RUNWAY_PATTERN = /^(\d{2}[LRC]?)/;

/**
 * Extracts the runway identifier from a CIFP approach identifier.
 *
 * The approach identifier's first character is the approach type code
 * (for example `I` for ILS, `R` for RNAV). Characters 2-5 encode the
 * runway (e.g. `04L ` for runway 4 Left) for runway-specific approaches
 * or a circling suffix (e.g. `-A  `, `OR-A`) for circling approaches.
 *
 * Returns the runway identifier (`04L`, `13`, etc.) when the approach
 * is runway-specific. Returns `undefined` for circling approaches and
 * any identifier that does not match the runway pattern.
 *
 * @param approachIdentifier - 5-6 character approach identifier from CIFP.
 */
export function runwayFromApproachIdentifier(approachIdentifier: string): string | undefined {
  if (approachIdentifier.length < 2) {
    return undefined;
  }
  const afterPrefix = approachIdentifier.substring(1).trimEnd();
  const match = RUNWAY_PATTERN.exec(afterPrefix);
  if (!match) {
    return undefined;
  }
  return match[1];
}
