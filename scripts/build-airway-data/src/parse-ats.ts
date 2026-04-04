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
  magneticCourse: number | undefined;
  /** Segment magnetic course - opposite direction. */
  magneticCourseOpposite: number | undefined;
  /** Segment distance in NM. */
  segmentDistanceNm: number | undefined;
  /** MEA in feet. */
  mea: number | undefined;
  /** MEA direction. */
  meaDirection: string | undefined;
  /** MEA opposite direction altitude. */
  meaOpposite: number | undefined;
  /** MEA opposite direction qualifier. */
  meaOppositeDirection: string | undefined;
  /** Maximum authorized altitude. */
  maa: number | undefined;
  /** MOCA in feet. */
  moca: number | undefined;
  /** Airway gap flag. */
  discontinued: boolean;
  /** Changeover distance in NM. */
  changeoverDistance: number | undefined;
  /** Minimum crossing altitude. */
  mca: number | undefined;
  /** MCA direction. */
  mcaDirection: string | undefined;
  /** MCA opposite direction altitude. */
  mcaOpposite: number | undefined;
  /** MCA opposite direction qualifier. */
  mcaOppositeDirection: string | undefined;
  /** Gap in signal coverage. */
  signalGap: boolean;
  /** US airspace only indicator. */
  usAirspaceOnly: boolean;
  /** ARTCC identifier. */
  artccId: string | undefined;
  /** GNSS MEA. */
  gnssMea: number | undefined;
  /** GNSS MEA direction. */
  gnssMeaDirection: string | undefined;
  /** GNSS MEA opposite. */
  gnssMeaOpposite: number | undefined;
  /** GNSS MEA opposite direction. */
  gnssMeaOppositeDirection: string | undefined;
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
  minimumReceptionAltitude: number | undefined;
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
    magneticCourse: numField(line, 67, 6),
    magneticCourseOpposite: numField(line, 73, 6),
    segmentDistanceNm: numField(line, 79, 6),
    mea: intField(line, 85, 5),
    meaDirection: strField(line, 90, 7),
    meaOpposite: intField(line, 97, 5),
    meaOppositeDirection: strField(line, 102, 7),
    maa: intField(line, 109, 5),
    moca: strField(line, 114, 5) !== undefined ? intField(line, 114, 5) : undefined,
    discontinued: field(line, 119, 1) === 'X',
    changeoverDistance: intField(line, 120, 3),
    mca: intField(line, 123, 5),
    mcaDirection: strField(line, 128, 7),
    mcaOpposite: intField(line, 135, 5),
    mcaOppositeDirection: strField(line, 140, 7),
    signalGap: field(line, 147, 1) === 'Y',
    usAirspaceOnly: field(line, 148, 1) === 'Y',
    artccId: strField(line, 154, 3),
    gnssMea: intField(line, 247, 5),
    gnssMeaDirection: strField(line, 252, 7),
    gnssMeaOpposite: intField(line, 259, 5),
    gnssMeaOppositeDirection: strField(line, 264, 7),
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
    minimumReceptionAltitude: intField(line, 138, 5),
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
  if (ats2.minimumReceptionAltitude !== undefined) {
    wp.minimumReceptionAltitude = ats2.minimumReceptionAltitude;
  }
  if (ats1.mea !== undefined) {
    wp.mea = ats1.mea;
  }
  if (ats1.meaDirection) {
    wp.meaDirection = ats1.meaDirection;
  }
  if (ats1.meaOpposite !== undefined) {
    wp.meaOpposite = ats1.meaOpposite;
  }
  if (ats1.meaOppositeDirection) {
    wp.meaOppositeDirection = ats1.meaOppositeDirection;
  }
  if (ats1.maa !== undefined) {
    wp.maa = ats1.maa;
  }
  if (ats1.moca !== undefined) {
    wp.moca = ats1.moca;
  }
  if (ats1.gnssMea !== undefined) {
    wp.gnssMea = ats1.gnssMea;
  }
  if (ats1.gnssMeaDirection) {
    wp.gnssMeaDirection = ats1.gnssMeaDirection;
  }
  if (ats1.gnssMeaOpposite !== undefined) {
    wp.gnssMeaOpposite = ats1.gnssMeaOpposite;
  }
  if (ats1.gnssMeaOppositeDirection) {
    wp.gnssMeaOppositeDirection = ats1.gnssMeaOppositeDirection;
  }
  if (ats1.mca !== undefined) {
    wp.mca = ats1.mca;
  }
  if (ats1.mcaDirection) {
    wp.mcaDirection = ats1.mcaDirection;
  }
  if (ats1.mcaOpposite !== undefined) {
    wp.mcaOpposite = ats1.mcaOpposite;
  }
  if (ats1.mcaOppositeDirection) {
    wp.mcaOppositeDirection = ats1.mcaOppositeDirection;
  }
  if (ats1.distanceToNextNm !== undefined) {
    wp.distanceToNextNm = ats1.distanceToNextNm;
  } else if (ats1.segmentDistanceNm !== undefined) {
    wp.distanceToNextNm = ats1.segmentDistanceNm;
  }
  if (ats1.magneticCourse !== undefined) {
    wp.magneticCourse = ats1.magneticCourse;
  }
  if (ats1.magneticCourseOpposite !== undefined) {
    wp.magneticCourseOpposite = ats1.magneticCourseOpposite;
  }
  if (ats1.changeoverDistance !== undefined) {
    wp.changeoverDistance = ats1.changeoverDistance;
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
