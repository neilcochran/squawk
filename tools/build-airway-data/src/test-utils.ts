import type { AirwayPointRecord, AirwaySegmentRecord } from './build-waypoint.js';

/**
 * One value placed at a 1-based column of a fixed-width record.
 */
export interface FixedWidthEntry {
  /** 1-based column of the field's first character. */
  col: number;
  /** Field width in characters. */
  len: number;
  /** Value, padded with spaces or cut to the field width. */
  value: string;
}

/**
 * Builds a fixed-width record line by placing values at 1-based column
 * positions and padding the rest with spaces. Positions past the last value
 * are filled with spaces up to maxLength.
 */
export function fixedWidthLine(entries: FixedWidthEntry[], maxLength = 400): string {
  const chars = Array<string>(maxLength).fill(' ');
  for (const { col, len, value } of entries) {
    const padded = value.padEnd(len, ' ').slice(0, len);
    for (let i = 0; i < len; i++) {
      chars[col - 1 + i] = padded[i] ?? ' ';
    }
  }
  return chars.join('');
}

/**
 * An AWY1 line for V16 sequence 1 with the given fields set.
 */
export function awy1Line(overrides: FixedWidthEntry[] = []): string {
  return fixedWidthLine([
    { col: 1, len: 4, value: 'AWY1' },
    { col: 5, len: 5, value: 'V16' },
    { col: 10, len: 1, value: ' ' },
    { col: 11, len: 5, value: '    1' },
    ...overrides,
  ]);
}

/**
 * An AWY2 line for V16 sequence 1 with the given fields set.
 */
export function awy2Line(overrides: FixedWidthEntry[] = []): string {
  return fixedWidthLine([
    { col: 1, len: 4, value: 'AWY2' },
    { col: 5, len: 5, value: 'V16' },
    { col: 10, len: 1, value: ' ' },
    { col: 11, len: 5, value: '    1' },
    ...overrides,
  ]);
}

/**
 * An ATS1 line for Atlantic route A315 sequence 1 with the given fields set.
 */
export function ats1Line(overrides: FixedWidthEntry[] = []): string {
  return fixedWidthLine([
    { col: 1, len: 4, value: 'ATS1' },
    { col: 5, len: 2, value: 'AT' },
    { col: 7, len: 12, value: 'A315' },
    { col: 21, len: 5, value: '    1' },
    ...overrides,
  ]);
}

/**
 * An ATS2 line for Atlantic route A315 sequence 1 with the given fields set.
 */
export function ats2Line(overrides: FixedWidthEntry[] = []): string {
  return fixedWidthLine([
    { col: 1, len: 4, value: 'ATS2' },
    { col: 5, len: 2, value: 'AT' },
    { col: 7, len: 12, value: 'A315' },
    { col: 21, len: 5, value: '    1' },
    ...overrides,
  ]);
}

/**
 * A segment record with nothing published, overridden field by field.
 */
export function segmentRecord(overrides: Partial<AirwaySegmentRecord> = {}): AirwaySegmentRecord {
  return {
    airwayTypeChar: '',
    sequenceNumber: 1,
    distanceToNextNm: undefined,
    magneticCourseDeg: undefined,
    magneticCourseOppositeDeg: undefined,
    segmentDistanceNm: undefined,
    minimumEnrouteAltitudeFt: undefined,
    minimumEnrouteAltitudeDirection: undefined,
    minimumEnrouteAltitudeOppositeFt: undefined,
    minimumEnrouteAltitudeOppositeDirection: undefined,
    maximumAuthorizedAltitudeFt: undefined,
    minimumObstructionClearanceAltitudeFt: undefined,
    discontinued: false,
    changeoverDistanceNm: undefined,
    minimumCrossingAltitudeFt: undefined,
    minimumCrossingAltitudeDirection: undefined,
    minimumCrossingAltitudeOppositeFt: undefined,
    minimumCrossingAltitudeOppositeDirection: undefined,
    minimumCrossingAltitudePoint: undefined,
    signalGap: false,
    usAirspaceOnly: false,
    magneticVariation: undefined,
    artccId: undefined,
    gnssMinimumEnrouteAltitudeFt: undefined,
    gnssMinimumEnrouteAltitudeDirection: undefined,
    gnssMinimumEnrouteAltitudeOppositeFt: undefined,
    gnssMinimumEnrouteAltitudeOppositeDirection: undefined,
    dmeDmeIruMinimumEnrouteAltitudeFt: undefined,
    dmeDmeIruMinimumEnrouteAltitudeDirection: undefined,
    dogleg: false,
    rnpNm: undefined,
    unusable: false,
    ...overrides,
  };
}

/**
 * A point record for the Kennedy VOR/DME, overridden field by field.
 */
export function pointRecord(overrides: Partial<AirwayPointRecord> = {}): AirwayPointRecord {
  return {
    airwayTypeChar: '',
    sequenceNumber: 1,
    name: 'KENNEDY',
    facilityType: 'VOR/DME',
    fixCategory: '',
    state: 'NY',
    icaoRegionCode: 'K6',
    latStr: '40-38-23.00N',
    lonStr: '073-46-43.00W',
    minimumReceptionAltitudeFt: undefined,
    navaidIdentifier: 'JFK',
    ...overrides,
  };
}

/**
 * A fix point record with the given name, at a position offset by its index
 * so consecutive fixes are distinct.
 */
export function fixRecord(name: string, sequenceNumber: number): AirwayPointRecord {
  return pointRecord({
    sequenceNumber,
    name,
    facilityType: 'REP-PT',
    navaidIdentifier: '',
    latStr: `40-${String(sequenceNumber).padStart(2, '0')}-00.00N`,
    lonStr: '074-00-00.00W',
  });
}
