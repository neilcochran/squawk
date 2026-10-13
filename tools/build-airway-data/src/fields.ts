import type { AirwayDirection } from '@squawk/types';
import { isAirwayDirection } from '@squawk/types';

/**
 * Extracts a trimmed substring from a fixed-width line.
 * Positions are 1-based per the FAA layout spec.
 */
export function field(line: string, start: number, length: number): string {
  return line.substring(start - 1, start - 1 + length).trim();
}

/**
 * Parses a numeric field, returning undefined if blank or NaN.
 */
export function numField(line: string, start: number, length: number): number | undefined {
  const val = field(line, start, length);
  if (val === '') {
    return undefined;
  }
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}

/**
 * Parses an integer field, returning undefined if blank or NaN.
 */
export function intField(line: string, start: number, length: number): number | undefined {
  const val = field(line, start, length);
  if (val === '') {
    return undefined;
  }
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

/**
 * Parses a string field, returning undefined if blank.
 */
export function strField(line: string, start: number, length: number): string | undefined {
  const val = field(line, start, length);
  return val === '' ? undefined : val;
}

/**
 * Parses an altitude direction field (`E BND`, `SW BND`). NASR writes a bare
 * `BND` template in every direction column whether or not an altitude is
 * published, so only the eight compass forms count as a direction.
 */
export function directionField(
  line: string,
  start: number,
  length: number,
): AirwayDirection | undefined {
  const val = field(line, start, length);
  return isAirwayDirection(val) ? val : undefined;
}

/**
 * A magnetic variation parsed from a `NNE` / `NNW` field such as `08E`.
 */
export interface MagneticVariation {
  /** Variation in whole degrees. */
  degrees: number;
  /** Direction of the variation. */
  direction: 'E' | 'W';
}

/**
 * Parses a magnetic variation field (`  08E`, ` 12W`), returning undefined
 * when blank or not in the published form.
 */
export function magneticVariationField(
  line: string,
  start: number,
  length: number,
): MagneticVariation | undefined {
  const match = /^(\d{1,3})([EW])$/.exec(field(line, start, length));
  const degreesText = match?.[1];
  const direction = match?.[2];
  if (degreesText === undefined || (direction !== 'E' && direction !== 'W')) {
    return undefined;
  }
  return { degrees: parseInt(degreesText, 10), direction };
}

/**
 * Parses the point named in a minimum crossing altitude point field, which
 * NASR writes as the airway designation followed by the point between
 * asterisks and its state code (`J70  *AUGER*WI`, `T245 *SMO*D`). Returns the
 * name or navaid identifier between the asterisks, or undefined when the field
 * is blank.
 */
export function crossingAltitudePointField(
  line: string,
  start: number,
  length: number,
): string | undefined {
  const name = /\*([^*]+)\*/.exec(field(line, start, length))?.[1]?.trim();
  return name === undefined || name === '' ? undefined : name;
}

/**
 * Parses a DMS (degrees-minutes-seconds) latitude/longitude string
 * from the FAA format into decimal degrees.
 *
 * Format: "DD-MM-SS.fracN" or "DDD-MM-SS.fracW"
 * Examples: "32-32-25.59N", "116-57-09.72W"
 */
export function parseDms(dms: string): number | undefined {
  if (!dms) {
    return undefined;
  }

  const match = dms.match(/(\d+)-(\d+)-(\d+\.?\d*)\s*([NSEW])/);
  const degText = match?.[1];
  const minText = match?.[2];
  const secText = match?.[3];
  const dir = match?.[4];
  if (
    degText === undefined ||
    minText === undefined ||
    secText === undefined ||
    dir === undefined
  ) {
    return undefined;
  }

  let decimal = parseInt(degText, 10) + parseInt(minText, 10) / 60 + parseFloat(secText) / 3600;
  if (dir === 'S' || dir === 'W') {
    decimal = -decimal;
  }

  return Math.round(decimal * 1e6) / 1e6;
}
