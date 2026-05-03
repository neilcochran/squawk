import type { AirwayWaypoint, AirwayWaypointType } from '@squawk/types';

/**
 * Parsed fields from an AWY1 (segment data) record.
 */
export interface Awy1Record {
  /** Airway designation (e.g. "J1", "V16", "Q1"). */
  designation: string;
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
  /** Segment distance in NM (second distance field). */
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
 * Parsed fields from an AWY2 (point description) record.
 */
export interface Awy2Record {
  /** Airway designation. */
  designation: string;
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
  /** Latitude string (DMS format). */
  latStr: string;
  /** Longitude string (DMS format). */
  lonStr: string;
  /** Minimum reception altitude. */
  minimumReceptionAltitudeFt: number | undefined;
  /** Navaid identifier. */
  navaidIdentifier: string;
}

/**
 * Extracts a trimmed substring from a fixed-width line.
 * Positions are 1-based per the FAA layout spec.
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
  if (!match) {
    return undefined;
  }

  const deg = parseInt(match[1]!, 10);
  const min = parseInt(match[2]!, 10);
  const sec = parseFloat(match[3]!);
  const dir = match[4]!;

  let decimal = deg + min / 60 + sec / 3600;
  if (dir === 'S' || dir === 'W') {
    decimal = -decimal;
  }

  return Math.round(decimal * 1e6) / 1e6;
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
    minimumEnrouteAltitudeDirection: strField(line, 80, 6),
    minimumEnrouteAltitudeOppositeFt: intField(line, 86, 5),
    minimumEnrouteAltitudeOppositeDirection: strField(line, 91, 6),
    maximumAuthorizedAltitudeFt: intField(line, 97, 5),
    minimumObstructionClearanceAltitudeFt:
      strField(line, 102, 5) !== undefined ? intField(line, 102, 5) : undefined,
    discontinued: field(line, 107, 1) === 'X',
    changeoverDistanceNm: intField(line, 108, 3),
    minimumCrossingAltitudeFt: intField(line, 111, 5),
    minimumCrossingAltitudeDirection: strField(line, 116, 7),
    minimumCrossingAltitudeOppositeFt: intField(line, 123, 5),
    minimumCrossingAltitudeOppositeDirection: strField(line, 128, 7),
    signalGap: field(line, 135, 1) === 'Y',
    usAirspaceOnly: field(line, 136, 1) === 'Y',
    artccId: strField(line, 142, 3),
    gnssMinimumEnrouteAltitudeFt: intField(line, 218, 5),
    gnssMinimumEnrouteAltitudeDirection: strField(line, 223, 6),
    gnssMinimumEnrouteAltitudeOppositeFt: intField(line, 229, 5),
    gnssMinimumEnrouteAltitudeOppositeDirection: strField(line, 234, 6),
    dogleg: field(line, 302, 1) === 'Y',
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
 * Determines the AirwayWaypointType from an AWY2 facility/fix type string.
 */
export function classifyWaypointType(facilityType: string, name: string): AirwayWaypointType {
  if (!facilityType) {
    if (name.includes('BORDER') || name.includes('MEXICAN') || name.includes('CANADIAN')) {
      return 'BORDER';
    }
    return 'OTHER';
  }

  const ft = facilityType.toUpperCase();

  if (
    ft.includes('VOR') ||
    ft.includes('VORTAC') ||
    ft.includes('NDB') ||
    ft.includes('TACAN') ||
    ft.includes('DME')
  ) {
    return 'NAVAID';
  }

  if (ft === 'WAY-PT') {
    return 'WAYPOINT';
  }

  if (
    ft === 'REP-PT' ||
    ft === 'AWY-INTXN' ||
    ft === 'COORDN-FIX' ||
    ft === 'MIL-REP-PT' ||
    ft === 'FIX' ||
    ft === 'TURN-PT'
  ) {
    return 'FIX';
  }

  if (ft === 'ARTCC-BDRY') {
    return 'OTHER';
  }

  return 'OTHER';
}

/**
 * Builds an AirwayWaypoint from a paired AWY1 + AWY2 record.
 */
export function buildWaypoint(awy1: Awy1Record, awy2: Awy2Record): AirwayWaypoint | undefined {
  const lat = parseDms(awy2.latStr);
  const lon = parseDms(awy2.lonStr);

  if (lat === undefined || lon === undefined) {
    return undefined;
  }

  const waypointType = classifyWaypointType(awy2.facilityType, awy2.name);

  const wp: AirwayWaypoint = {
    name: awy2.name,
    waypointType,
    lat,
    lon,
  };

  if (awy2.navaidIdentifier) {
    wp.identifier = awy2.navaidIdentifier;
  } else if (waypointType === 'FIX' || waypointType === 'WAYPOINT') {
    wp.identifier = awy2.name;
  }

  if (waypointType === 'NAVAID' && awy2.facilityType) {
    wp.navaidFacilityType = awy2.facilityType;
  }
  if (awy2.state) {
    wp.state = awy2.state;
  }
  if (awy2.icaoRegionCode) {
    wp.icaoRegionCode = awy2.icaoRegionCode;
  }
  if (awy1.artccId) {
    wp.artccId = awy1.artccId;
  }
  if (awy2.minimumReceptionAltitudeFt !== undefined) {
    wp.minimumReceptionAltitudeFt = awy2.minimumReceptionAltitudeFt;
  }
  if (awy1.minimumEnrouteAltitudeFt !== undefined) {
    wp.minimumEnrouteAltitudeFt = awy1.minimumEnrouteAltitudeFt;
  }
  if (awy1.minimumEnrouteAltitudeDirection) {
    wp.minimumEnrouteAltitudeDirection = awy1.minimumEnrouteAltitudeDirection;
  }
  if (awy1.minimumEnrouteAltitudeOppositeFt !== undefined) {
    wp.minimumEnrouteAltitudeOppositeFt = awy1.minimumEnrouteAltitudeOppositeFt;
  }
  if (awy1.minimumEnrouteAltitudeOppositeDirection) {
    wp.minimumEnrouteAltitudeOppositeDirection = awy1.minimumEnrouteAltitudeOppositeDirection;
  }
  if (awy1.maximumAuthorizedAltitudeFt !== undefined) {
    wp.maximumAuthorizedAltitudeFt = awy1.maximumAuthorizedAltitudeFt;
  }
  if (awy1.minimumObstructionClearanceAltitudeFt !== undefined) {
    wp.minimumObstructionClearanceAltitudeFt = awy1.minimumObstructionClearanceAltitudeFt;
  }
  if (awy1.gnssMinimumEnrouteAltitudeFt !== undefined) {
    wp.gnssMinimumEnrouteAltitudeFt = awy1.gnssMinimumEnrouteAltitudeFt;
  }
  if (awy1.gnssMinimumEnrouteAltitudeDirection) {
    wp.gnssMinimumEnrouteAltitudeDirection = awy1.gnssMinimumEnrouteAltitudeDirection;
  }
  if (awy1.gnssMinimumEnrouteAltitudeOppositeFt !== undefined) {
    wp.gnssMinimumEnrouteAltitudeOppositeFt = awy1.gnssMinimumEnrouteAltitudeOppositeFt;
  }
  if (awy1.gnssMinimumEnrouteAltitudeOppositeDirection) {
    wp.gnssMinimumEnrouteAltitudeOppositeDirection =
      awy1.gnssMinimumEnrouteAltitudeOppositeDirection;
  }
  if (awy1.minimumCrossingAltitudeFt !== undefined) {
    wp.minimumCrossingAltitudeFt = awy1.minimumCrossingAltitudeFt;
  }
  if (awy1.minimumCrossingAltitudeDirection) {
    wp.minimumCrossingAltitudeDirection = awy1.minimumCrossingAltitudeDirection;
  }
  if (awy1.minimumCrossingAltitudeOppositeFt !== undefined) {
    wp.minimumCrossingAltitudeOppositeFt = awy1.minimumCrossingAltitudeOppositeFt;
  }
  if (awy1.minimumCrossingAltitudeOppositeDirection) {
    wp.minimumCrossingAltitudeOppositeDirection = awy1.minimumCrossingAltitudeOppositeDirection;
  }
  if (awy1.distanceToNextNm !== undefined) {
    wp.distanceToNextNm = awy1.distanceToNextNm;
  } else if (awy1.segmentDistanceNm !== undefined) {
    wp.distanceToNextNm = awy1.segmentDistanceNm;
  }
  if (awy1.magneticCourseDeg !== undefined) {
    wp.magneticCourseDeg = awy1.magneticCourseDeg;
  }
  if (awy1.magneticCourseOppositeDeg !== undefined) {
    wp.magneticCourseOppositeDeg = awy1.magneticCourseOppositeDeg;
  }
  if (awy1.changeoverDistanceNm !== undefined) {
    wp.changeoverDistanceNm = awy1.changeoverDistanceNm;
  }
  if (awy1.signalGap) {
    wp.signalGap = true;
  }
  if (awy1.usAirspaceOnly) {
    wp.usAirspaceOnly = true;
  }
  if (awy1.dogleg) {
    wp.dogleg = true;
  }
  if (awy1.discontinued) {
    wp.discontinued = true;
  }

  return wp;
}
