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
 * Parsed fields from an AWY1 (segment data) record.
 */
export interface Awy1Record extends AirwaySegmentRecord {
  /** Airway designation (e.g. "J1", "V16", "Q1"). */
  designation: string;
}

/**
 * Parsed fields from an AWY2 (point description) record.
 */
export interface Awy2Record extends AirwayPointRecord {
  /** Airway designation. */
  designation: string;
}

/**
 * Parsed fields from an AWY4 (point remark) record.
 */
export interface Awy4Record {
  /** Airway designation. */
  designation: string;
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
export interface AwyRemarkRecord {
  /** Airway designation. */
  designation: string;
  /** Airway type character. */
  airwayTypeChar: string;
  /** One line of remark text. */
  text: string;
}

/**
 * Parses an AWY1 record line from AWY.txt.
 */
export function parseAwy1(line: string): Awy1Record {
  return {
    designation: field(line, 5, 5),
    airwayTypeChar: field(line, 10, 1),
    sequenceNumber: parseInt(field(line, 11, 5), 10),
    distanceToNextNm: numField(line, 45, 6),
    magneticCourseDeg: numField(line, 57, 6),
    magneticCourseOppositeDeg: numField(line, 63, 6),
    segmentDistanceNm: numField(line, 69, 6),
    minimumEnrouteAltitudeFt: intField(line, 75, 5),
    minimumEnrouteAltitudeDirection: directionField(line, 80, 6),
    minimumEnrouteAltitudeOppositeFt: intField(line, 86, 5),
    minimumEnrouteAltitudeOppositeDirection: directionField(line, 91, 6),
    maximumAuthorizedAltitudeFt: intField(line, 97, 5),
    minimumObstructionClearanceAltitudeFt: intField(line, 102, 5),
    discontinued: field(line, 107, 1) === 'X',
    changeoverDistanceNm: intField(line, 108, 3),
    minimumCrossingAltitudeFt: intField(line, 111, 5),
    minimumCrossingAltitudeDirection: directionField(line, 116, 7),
    minimumCrossingAltitudeOppositeFt: intField(line, 123, 5),
    minimumCrossingAltitudeOppositeDirection: directionField(line, 128, 7),
    signalGap: field(line, 135, 1) === 'Y',
    usAirspaceOnly: field(line, 136, 1) === 'Y',
    magneticVariation: magneticVariationField(line, 137, 5),
    artccId: strField(line, 142, 3),
    gnssMinimumEnrouteAltitudeFt: intField(line, 218, 5),
    gnssMinimumEnrouteAltitudeDirection: directionField(line, 223, 6),
    gnssMinimumEnrouteAltitudeOppositeFt: intField(line, 229, 5),
    gnssMinimumEnrouteAltitudeOppositeDirection: directionField(line, 234, 6),
    minimumCrossingAltitudePoint: crossingAltitudePointField(line, 240, 40),
    dmeDmeIruMinimumEnrouteAltitudeFt: intField(line, 280, 5),
    dmeDmeIruMinimumEnrouteAltitudeDirection: directionField(line, 285, 6),
    dogleg: field(line, 302, 1) === 'Y',
    rnpNm: numField(line, 303, 5),
    unusable: field(line, 308, 1) === 'U',
  };
}

/**
 * Parses an AWY2 record line from AWY.txt.
 */
export function parseAwy2(line: string): Awy2Record {
  return {
    designation: field(line, 5, 5),
    airwayTypeChar: field(line, 10, 1),
    sequenceNumber: parseInt(field(line, 11, 5), 10),
    name: field(line, 16, 30),
    facilityType: field(line, 46, 19),
    fixCategory: field(line, 65, 15),
    state: field(line, 80, 2),
    icaoRegionCode: field(line, 82, 2),
    latStr: field(line, 84, 14),
    lonStr: field(line, 98, 14),
    minimumReceptionAltitudeFt: intField(line, 112, 5),
    navaidIdentifier: field(line, 117, 4),
  };
}

/**
 * Parses an AWY4 record line from AWY.txt.
 */
export function parseAwy4(line: string): Awy4Record {
  return {
    designation: field(line, 5, 5),
    airwayTypeChar: field(line, 10, 1),
    sequenceNumber: parseInt(field(line, 11, 5), 10),
    text: field(line, 16, 202),
  };
}

/**
 * Parses an RMK record line from AWY.txt.
 */
export function parseAwyRemark(line: string): AwyRemarkRecord {
  return {
    designation: field(line, 5, 5),
    airwayTypeChar: field(line, 10, 1),
    text: field(line, 20, 220),
  };
}
