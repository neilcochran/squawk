import type { AirwayPointRecord, AirwaySegmentRecord } from './build-waypoint.js';
import {
  crossingAltitudePointField,
  directionField,
  field,
  intField,
  magneticVariationField,
  numField,
  strField,
} from './fields.js';

/**
 * Parsed fields from an ATS1 (segment data) record.
 */
export interface Ats1Record extends AirwaySegmentRecord {
  /** ATS designation prefix, the route category (e.g. "AT", "BF", "PA", "PR", "SP"). */
  designationPrefix: string;
  /** ATS airway ID (e.g. "A315", "A509", "ZK214"). */
  airwayId: string;
  /** Full designation (prefix + ID, e.g. "ATA315"). */
  fullDesignation: string;
  /** RNAV indicator ("R" or blank). */
  rnavIndicator: string;
}

/**
 * Parsed fields from an ATS2 (point description) record.
 */
export interface Ats2Record extends AirwayPointRecord {
  /** Full designation. */
  fullDesignation: string;
}

/**
 * Parsed fields from an ATS4 (point remark) record.
 */
export interface Ats4Record {
  /** Full designation. */
  fullDesignation: string;
  /** Airway type character. */
  airwayTypeChar: string;
  /** Sequence number of the point the remark is about. */
  sequenceNumber: number;
  /** One line of remark text. */
  text: string;
}

/**
 * Parsed fields from an RMK (route remark) record.
 */
export interface AtsRemarkRecord {
  /** Full designation. */
  fullDesignation: string;
  /** Airway type character. */
  airwayTypeChar: string;
  /** One line of remark text. */
  text: string;
}

/**
 * Reads the full designation of an ATS record: the two-character category
 * prefix followed by the route identifier.
 */
function fullDesignationOf(line: string): string {
  return field(line, 5, 2) + field(line, 7, 12);
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
    minimumEnrouteAltitudeDirection: directionField(line, 90, 7),
    minimumEnrouteAltitudeOppositeFt: intField(line, 97, 5),
    minimumEnrouteAltitudeOppositeDirection: directionField(line, 102, 7),
    maximumAuthorizedAltitudeFt: intField(line, 109, 5),
    minimumObstructionClearanceAltitudeFt: intField(line, 114, 5),
    discontinued: field(line, 119, 1) === 'X',
    changeoverDistanceNm: intField(line, 120, 3),
    minimumCrossingAltitudeFt: intField(line, 123, 5),
    minimumCrossingAltitudeDirection: directionField(line, 128, 7),
    minimumCrossingAltitudeOppositeFt: intField(line, 135, 5),
    minimumCrossingAltitudeOppositeDirection: directionField(line, 140, 7),
    signalGap: field(line, 147, 1) === 'Y',
    usAirspaceOnly: field(line, 148, 1) === 'Y',
    magneticVariation: magneticVariationField(line, 149, 5),
    artccId: strField(line, 154, 3),
    gnssMinimumEnrouteAltitudeFt: intField(line, 247, 5),
    gnssMinimumEnrouteAltitudeDirection: directionField(line, 252, 7),
    gnssMinimumEnrouteAltitudeOppositeFt: intField(line, 259, 5),
    gnssMinimumEnrouteAltitudeOppositeDirection: directionField(line, 264, 7),
    minimumCrossingAltitudePoint: crossingAltitudePointField(line, 271, 50),
    dmeDmeIruMinimumEnrouteAltitudeFt: intField(line, 321, 5),
    dmeDmeIruMinimumEnrouteAltitudeDirection: directionField(line, 326, 6),
    dmeDmeIruMinimumEnrouteAltitudeOppositeFt: intField(line, 332, 5),
    dmeDmeIruMinimumEnrouteAltitudeOppositeDirection: directionField(line, 337, 6),
    dogleg: field(line, 343, 1) === 'Y',
    rnpNm: numField(line, 344, 5),
    unusable: field(line, 349, 1) === 'U',
  };
}

/**
 * Parses an ATS2 record line from ATS.txt.
 */
export function parseAts2(line: string): Ats2Record {
  return {
    fullDesignation: fullDesignationOf(line),
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
 * Parses an ATS4 record line from ATS.txt.
 */
export function parseAts4(line: string): Ats4Record {
  return {
    fullDesignation: fullDesignationOf(line),
    airwayTypeChar: field(line, 20, 1),
    sequenceNumber: parseInt(field(line, 21, 5), 10),
    text: field(line, 26, 200),
  };
}

/**
 * Parses an RMK record line from ATS.txt.
 */
export function parseAtsRemark(line: string): AtsRemarkRecord {
  return {
    fullDesignation: fullDesignationOf(line),
    airwayTypeChar: field(line, 20, 1),
    text: field(line, 29, 200),
  };
}
