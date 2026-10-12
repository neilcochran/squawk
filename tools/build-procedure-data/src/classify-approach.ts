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
 * sidedness indicator and not by a further digit. A three-digit group
 * (`R027`) is a final approach course, used by approaches that are not
 * aligned with a runway, and carries no runway.
 */
const RUNWAY_PATTERN = /^(\d{2}[LRC]?)(?!\d)/;

/**
 * Pattern matching what follows the runway in a runway-specific
 * approach identifier when the airport has several approaches of the
 * same type to that runway: an optional `-` filler (present when the
 * runway has no sidedness letter) and the multiple-approach indicator
 * letter, e.g. `-Y` in `R21-Y` or `Z` in `I01LZ`.
 */
const MULTIPLE_INDICATOR_PATTERN = /^-?([A-Z])$/;

/**
 * Pattern matching a final approach course identifier body: exactly
 * three digits, e.g. `027` in `R027`.
 */
const COURSE_PATTERN = /^(\d{3})$/;

/**
 * Pattern matching a circling approach identifier body: up to three
 * letters abbreviating the approach type (`OR` in `VOR-A`, `NV` in
 * `RNV-B`, `DM` in `VDM-A`), an optional `-`, and the circling letter.
 */
const CIRCLING_PATTERN = /^[A-Z]{0,3}-?([A-Z])$/;

/**
 * Returns the approach identifier without its leading approach type
 * letter and trailing padding, or `undefined` when the identifier is
 * too short to carry anything after the type letter.
 */
function approachIdentifierBody(approachIdentifier: string): string | undefined {
  if (approachIdentifier.length < 2) {
    return undefined;
  }
  return approachIdentifier.substring(1).trimEnd();
}

/**
 * Extracts the runway identifier from a CIFP approach identifier.
 *
 * The approach identifier's first character is the approach type code
 * (for example `I` for ILS, `R` for RNAV). Characters 2-5 encode the
 * runway (e.g. `04L ` for runway 4 Left) for runway-specific approaches,
 * a final approach course (e.g. `027`) for approaches not aligned with
 * a runway, or a circling suffix (e.g. `-A  `, `OR-A`) for circling
 * approaches.
 *
 * Returns the runway identifier (`04L`, `13`, etc.) when the approach
 * is runway-specific. Returns `undefined` for course-named and circling
 * approaches and any identifier that does not match the runway pattern.
 *
 * @param approachIdentifier - 5-6 character approach identifier from CIFP.
 */
export function runwayFromApproachIdentifier(approachIdentifier: string): string | undefined {
  const body = approachIdentifierBody(approachIdentifier);
  if (body === undefined) {
    return undefined;
  }
  const match = RUNWAY_PATTERN.exec(body);
  return match?.[1];
}

/**
 * Extracts the multiple-approach indicator letter from a runway-specific
 * CIFP approach identifier. CIFP appends the letter when an airport
 * publishes several approaches of the same type to the same runway;
 * FAA charts print it between the approach type and the runway, so
 * `I01LZ` is "ILS Z RWY 01L" and `R21-Y` is "RNAV (GPS) Y RWY 21".
 *
 * Returns `undefined` when the identifier is not runway-specific or
 * carries no indicator.
 *
 * @param approachIdentifier - 5-6 character approach identifier from CIFP.
 */
export function multipleIndicatorFromApproachIdentifier(
  approachIdentifier: string,
): string | undefined {
  const body = approachIdentifierBody(approachIdentifier);
  if (body === undefined) {
    return undefined;
  }
  const runway = RUNWAY_PATTERN.exec(body)?.[1];
  if (runway === undefined) {
    return undefined;
  }
  return MULTIPLE_INDICATOR_PATTERN.exec(body.substring(runway.length))?.[1];
}

/**
 * Extracts the three-digit final approach course from a CIFP approach
 * identifier that names its approach by course rather than by runway
 * (`R027` -> `027`). Returns `undefined` for every other identifier.
 *
 * @param approachIdentifier - 5-6 character approach identifier from CIFP.
 */
export function courseFromApproachIdentifier(approachIdentifier: string): string | undefined {
  const body = approachIdentifierBody(approachIdentifier);
  if (body === undefined) {
    return undefined;
  }
  return COURSE_PATTERN.exec(body)?.[1];
}

/**
 * Extracts the circling letter from a circling-approach CIFP identifier
 * (`VOR-A` -> `A`, `RNV-B` -> `B`, `RNVA` -> `A`). Returns `undefined`
 * for runway-specific and course-named identifiers and for identifiers
 * that carry nothing after the approach type letter.
 *
 * @param approachIdentifier - 5-6 character approach identifier from CIFP.
 */
export function circlingLetterFromApproachIdentifier(
  approachIdentifier: string,
): string | undefined {
  const body = approachIdentifierBody(approachIdentifier);
  if (body === undefined) {
    return undefined;
  }
  return CIRCLING_PATTERN.exec(body)?.[1];
}
