import type { AirwayWaypoint } from '@squawk/types';
import { parseDms, classifyWaypointType } from './parse-awy.js';

/**
 * Parsed fields from an ATS1 (segment data) record.
 */
export interface Ats1Record {
  /** ATS designation prefix (e.g. "AT", "BF", "PA", "PR"). */
  designationPrefix: string;
  /** ATS airway ID (e.g. "A315", "A509"). */
  airwayId: string;
  /** Full designation (prefix + ID, e.g. "ATA315"). */
  fullDesignation: string;
  /** RNAV indicator ("R" or blank). */
  rnavIndicator: string;
  /** Airway type character (blank, A, or H). */
  airwayTypeChar: string;
  /** Airway point sequence number. */
  sequenceNumber: number;
  /** Distance to next point in nautical miles. */
  distanceToNextNm: number | undefined;
  /** Segment magnetic course. */
  magneticCourseDeg: number | undefined;
  /** Segment magnetic course - opposite direction. */
  magneticCourseOppositeDeg: number | undefined;
  /** Segment distance in NM. */
  segmentDistanceNm: number | undefined;
  /** MEA in feet. */
  minimumEnrouteAltitudeFt: number | undefined;
  /** MEA direction. */
  minimumEnrouteAltitudeDirection: string | undefined;
  /** MEA opposite direction altitude. */
  minimumEnrouteAltitudeOppositeFt: number | undefined;
  /** MEA opposite direction qualifier. */
  minimumEnrouteAltitudeOppositeDirection: string | undefined;
  /** Maximum authorized altitude. */
  maximumAuthorizedAltitudeFt: number | undefined;
  /** MOCA in feet. */
  minimumObstructionClearanceAltitudeFt: number | undefined;
  /** Airway gap flag. */
  discontinued: boolean;
  /** Changeover distance in NM. */
  changeoverDistanceNm: number | undefined;
  /** Minimum crossing altitude. */
  minimumCrossingAltitudeFt: number | undefined;
  /** MCA direction. */
  minimumCrossingAltitudeDirection: string | undefined;
  /** MCA opposite direction altitude. */
  minimumCrossingAltitudeOppositeFt: number | undefined;
  /** MCA opposite direction qualifier. */
  minimumCrossingAltitudeOppositeDirection: string | undefined;
  /** Gap in signal coverage. */
  signalGap: boolean;
  /** US airspace only indicator. */
  usAirspaceOnly: boolean;
  /** ARTCC identifier. */
  artccId: string | undefined;
  /** GNSS MEA. */
  gnssMinimumEnrouteAltitudeFt: number | undefined;
  /** GNSS MEA direction. */
  gnssMinimumEnrouteAltitudeDirection: string | undefined;
  /** GNSS MEA opposite. */
  gnssMinimumEnrouteAltitudeOppositeFt: number | undefined;
  /** GNSS MEA opposite direction. */
  gnssMinimumEnrouteAltitudeOppositeDirection: string | undefined;
  /** Dogleg indicator. */
  dogleg: boolean;
}

/**
 * Parsed fields from an ATS2 (point description) record.
 */
export interface Ats2Record {
  /** Full designation. */
  fullDesignation: string;
  /** Airway type character. */
  airwayTypeChar: string;
  /** Airway point sequence number. */
  sequenceNumber: number;
  /** Navaid/fix name. */
  name: string;
  /** Navaid facility type or fix type. */
  facilityType: string;
  /** Fix publication category. */
  fixCategory: string;
  /** State code. */
  state: string;
  /** ICAO region code. */
  icaoRegionCode: string;
  /** Latitude string. */
  latStr: string;
  /** Longitude string. */
  lonStr: string;
  /** Minimum reception altitude. */
  minimumReceptionAltitudeFt: number | undefined;
  /** Navaid identifier. */
  navaidIdentifier: string;
}

/**
 * Extracts a trimmed substring from a fixed-width line.
 */
function field(line: string, start: number, length: number): string {
  return line.substring(start - 1, start - 1 + length).trim();
}

/**
 * Parses a numeric field, returning undefined if blank or NaN.
 */
function numField(line: string, start: number, length: number): number | undefined {
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
function intField(line: string, start: number, length: number): number | undefined {
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
function strField(line: string, start: number, length: number): string | undefined {
  const val = field(line, start, length);
  return val === '' ? undefined : val;
}

/**
 * Parses an ATS1 record line from ATS.txt.
 */
export function parseAts1(line: string): Ats1Record {
  const designationPrefix = field(line, 5, 2);
  const airwayId = field(line, 7, 12);
  return {
    designationPrefix,
    airwayId,
    fullDesignation: designationPrefix + airwayId,
    rnavIndicator: field(line, 19, 1),
    airwayTypeChar: field(line, 20, 1),
    sequenceNumber: parseInt(field(line, 21, 5), 10),
    distanceToNextNm: numField(line, 55, 6),
    magneticCourseDeg: numField(line, 67, 6),
    magneticCourseOppositeDeg: numField(line, 73, 6),
    segmentDistanceNm: numField(line, 79, 6),
    minimumEnrouteAltitudeFt: intField(line, 85, 5),
    minimumEnrouteAltitudeDirection: strField(line, 90, 7),
    minimumEnrouteAltitudeOppositeFt: intField(line, 97, 5),
    minimumEnrouteAltitudeOppositeDirection: strField(line, 102, 7),
    maximumAuthorizedAltitudeFt: intField(line, 109, 5),
    minimumObstructionClearanceAltitudeFt:
      strField(line, 114, 5) !== undefined ? intField(line, 114, 5) : undefined,
    discontinued: field(line, 119, 1) === 'X',
    changeoverDistanceNm: intField(line, 120, 3),
    minimumCrossingAltitudeFt: intField(line, 123, 5),
    minimumCrossingAltitudeDirection: strField(line, 128, 7),
    minimumCrossingAltitudeOppositeFt: intField(line, 135, 5),
    minimumCrossingAltitudeOppositeDirection: strField(line, 140, 7),
    signalGap: field(line, 147, 1) === 'Y',
    usAirspaceOnly: field(line, 148, 1) === 'Y',
    artccId: strField(line, 154, 3),
    gnssMinimumEnrouteAltitudeFt: intField(line, 247, 5),
    gnssMinimumEnrouteAltitudeDirection: strField(line, 252, 7),
    gnssMinimumEnrouteAltitudeOppositeFt: intField(line, 259, 5),
    gnssMinimumEnrouteAltitudeOppositeDirection: strField(line, 264, 7),
    dogleg: field(line, 343, 1) === 'Y',
  };
}

/**
 * Parses an ATS2 record line from ATS.txt.
 */
export function parseAts2(line: string): Ats2Record {
  const designationPrefix = field(line, 5, 2);
  const airwayId = field(line, 7, 12);
  return {
    fullDesignation: designationPrefix + airwayId,
    airwayTypeChar: field(line, 20, 1),
    sequenceNumber: parseInt(field(line, 21, 5), 10),
    name: field(line, 26, 40),
    facilityType: field(line, 66, 25),
    fixCategory: field(line, 91, 15),
    state: field(line, 106, 2),
    icaoRegionCode: field(line, 108, 2),
    latStr: field(line, 110, 14),
    lonStr: field(line, 124, 14),
    minimumReceptionAltitudeFt: intField(line, 138, 5),
    navaidIdentifier: field(line, 143, 4),
  };
}

/**
 * Builds an AirwayWaypoint from a paired ATS1 + ATS2 record.
 */
export function buildAtsWaypoint(ats1: Ats1Record, ats2: Ats2Record): AirwayWaypoint | undefined {
  const lat = parseDms(ats2.latStr);
  const lon = parseDms(ats2.lonStr);

  if (lat === undefined || lon === undefined) {
    return undefined;
  }

  const waypointType = classifyWaypointType(ats2.facilityType, ats2.name);

  const wp: AirwayWaypoint = {
    name: ats2.name,
    waypointType,
    lat,
    lon,
  };

  if (ats2.navaidIdentifier) {
    wp.identifier = ats2.navaidIdentifier;
  } else if (waypointType === 'FIX' || waypointType === 'WAYPOINT') {
    wp.identifier = ats2.name;
  }

  if (waypointType === 'NAVAID' && ats2.facilityType) {
    wp.navaidFacilityType = ats2.facilityType;
  }
  if (ats2.state) {
    wp.state = ats2.state;
  }
  if (ats2.icaoRegionCode) {
    wp.icaoRegionCode = ats2.icaoRegionCode;
  }
  if (ats1.artccId) {
    wp.artccId = ats1.artccId;
  }
  if (ats2.minimumReceptionAltitudeFt !== undefined) {
    wp.minimumReceptionAltitudeFt = ats2.minimumReceptionAltitudeFt;
  }
  if (ats1.minimumEnrouteAltitudeFt !== undefined) {
    wp.minimumEnrouteAltitudeFt = ats1.minimumEnrouteAltitudeFt;
  }
  if (ats1.minimumEnrouteAltitudeDirection) {
    wp.minimumEnrouteAltitudeDirection = ats1.minimumEnrouteAltitudeDirection;
  }
  if (ats1.minimumEnrouteAltitudeOppositeFt !== undefined) {
    wp.minimumEnrouteAltitudeOppositeFt = ats1.minimumEnrouteAltitudeOppositeFt;
  }
  if (ats1.minimumEnrouteAltitudeOppositeDirection) {
    wp.minimumEnrouteAltitudeOppositeDirection = ats1.minimumEnrouteAltitudeOppositeDirection;
  }
  if (ats1.maximumAuthorizedAltitudeFt !== undefined) {
    wp.maximumAuthorizedAltitudeFt = ats1.maximumAuthorizedAltitudeFt;
  }
  if (ats1.minimumObstructionClearanceAltitudeFt !== undefined) {
    wp.minimumObstructionClearanceAltitudeFt = ats1.minimumObstructionClearanceAltitudeFt;
  }
  if (ats1.gnssMinimumEnrouteAltitudeFt !== undefined) {
    wp.gnssMinimumEnrouteAltitudeFt = ats1.gnssMinimumEnrouteAltitudeFt;
  }
  if (ats1.gnssMinimumEnrouteAltitudeDirection) {
    wp.gnssMinimumEnrouteAltitudeDirection = ats1.gnssMinimumEnrouteAltitudeDirection;
  }
  if (ats1.gnssMinimumEnrouteAltitudeOppositeFt !== undefined) {
    wp.gnssMinimumEnrouteAltitudeOppositeFt = ats1.gnssMinimumEnrouteAltitudeOppositeFt;
  }
  if (ats1.gnssMinimumEnrouteAltitudeOppositeDirection) {
    wp.gnssMinimumEnrouteAltitudeOppositeDirection =
      ats1.gnssMinimumEnrouteAltitudeOppositeDirection;
  }
  if (ats1.minimumCrossingAltitudeFt !== undefined) {
    wp.minimumCrossingAltitudeFt = ats1.minimumCrossingAltitudeFt;
  }
  if (ats1.minimumCrossingAltitudeDirection) {
    wp.minimumCrossingAltitudeDirection = ats1.minimumCrossingAltitudeDirection;
  }
  if (ats1.minimumCrossingAltitudeOppositeFt !== undefined) {
    wp.minimumCrossingAltitudeOppositeFt = ats1.minimumCrossingAltitudeOppositeFt;
  }
  if (ats1.minimumCrossingAltitudeOppositeDirection) {
    wp.minimumCrossingAltitudeOppositeDirection = ats1.minimumCrossingAltitudeOppositeDirection;
  }
  if (ats1.distanceToNextNm !== undefined) {
    wp.distanceToNextNm = ats1.distanceToNextNm;
  } else if (ats1.segmentDistanceNm !== undefined) {
    wp.distanceToNextNm = ats1.segmentDistanceNm;
  }
  if (ats1.magneticCourseDeg !== undefined) {
    wp.magneticCourseDeg = ats1.magneticCourseDeg;
  }
  if (ats1.magneticCourseOppositeDeg !== undefined) {
    wp.magneticCourseOppositeDeg = ats1.magneticCourseOppositeDeg;
  }
  if (ats1.changeoverDistanceNm !== undefined) {
    wp.changeoverDistanceNm = ats1.changeoverDistanceNm;
  }
  if (ats1.signalGap) {
    wp.signalGap = true;
  }
  if (ats1.usAirspaceOnly) {
    wp.usAirspaceOnly = true;
  }
  if (ats1.dogleg) {
    wp.dogleg = true;
  }
  if (ats1.discontinued) {
    wp.discontinued = true;
  }

  return wp;
}
