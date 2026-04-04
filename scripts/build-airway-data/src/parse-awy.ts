import type {
  Airway,
  AirwayType,
  AirwayRegion,
  AirwayWaypoint,
  AirwayWaypointType,
  AWY_TYPE_MAP,
  AIRWAY_REGION_MAP,
} from '@squawk/types';

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
  magneticCourse: number | undefined;
  /** Segment magnetic course - opposite direction. */
  magneticCourseOpposite: number | undefined;
  /** Segment distance in NM (second distance field). */
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
  minimumReceptionAltitude: number | undefined;
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
    magneticCourse: numField(line, 57, 6),
    magneticCourseOpposite: numField(line, 63, 6),
    segmentDistanceNm: numField(line, 69, 6),
    mea: intField(line, 75, 5),
    meaDirection: strField(line, 80, 6),
    meaOpposite: intField(line, 86, 5),
    meaOppositeDirection: strField(line, 91, 6),
    maa: intField(line, 97, 5),
    moca: strField(line, 102, 5) !== undefined ? intField(line, 102, 5) : undefined,
    discontinued: field(line, 107, 1) === 'X',
    changeoverDistance: intField(line, 108, 3),
    mca: intField(line, 111, 5),
    mcaDirection: strField(line, 116, 7),
    mcaOpposite: intField(line, 123, 5),
    mcaOppositeDirection: strField(line, 128, 7),
    signalGap: field(line, 135, 1) === 'Y',
    usAirspaceOnly: field(line, 136, 1) === 'Y',
    artccId: strField(line, 142, 3),
    gnssMea: intField(line, 218, 5),
    gnssMeaDirection: strField(line, 223, 6),
    gnssMeaOpposite: intField(line, 229, 5),
    gnssMeaOppositeDirection: strField(line, 234, 6),
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
    minimumReceptionAltitude: intField(line, 112, 5),
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
  if (awy2.minimumReceptionAltitude !== undefined) {
    wp.minimumReceptionAltitude = awy2.minimumReceptionAltitude;
  }
  if (awy1.mea !== undefined) {
    wp.mea = awy1.mea;
  }
  if (awy1.meaDirection) {
    wp.meaDirection = awy1.meaDirection;
  }
  if (awy1.meaOpposite !== undefined) {
    wp.meaOpposite = awy1.meaOpposite;
  }
  if (awy1.meaOppositeDirection) {
    wp.meaOppositeDirection = awy1.meaOppositeDirection;
  }
  if (awy1.maa !== undefined) {
    wp.maa = awy1.maa;
  }
  if (awy1.moca !== undefined) {
    wp.moca = awy1.moca;
  }
  if (awy1.gnssMea !== undefined) {
    wp.gnssMea = awy1.gnssMea;
  }
  if (awy1.gnssMeaDirection) {
    wp.gnssMeaDirection = awy1.gnssMeaDirection;
  }
  if (awy1.gnssMeaOpposite !== undefined) {
    wp.gnssMeaOpposite = awy1.gnssMeaOpposite;
  }
  if (awy1.gnssMeaOppositeDirection) {
    wp.gnssMeaOppositeDirection = awy1.gnssMeaOppositeDirection;
  }
  if (awy1.mca !== undefined) {
    wp.mca = awy1.mca;
  }
  if (awy1.mcaDirection) {
    wp.mcaDirection = awy1.mcaDirection;
  }
  if (awy1.mcaOpposite !== undefined) {
    wp.mcaOpposite = awy1.mcaOpposite;
  }
  if (awy1.mcaOppositeDirection) {
    wp.mcaOppositeDirection = awy1.mcaOppositeDirection;
  }
  if (awy1.distanceToNextNm !== undefined) {
    wp.distanceToNextNm = awy1.distanceToNextNm;
  } else if (awy1.segmentDistanceNm !== undefined) {
    wp.distanceToNextNm = awy1.segmentDistanceNm;
  }
  if (awy1.magneticCourse !== undefined) {
    wp.magneticCourse = awy1.magneticCourse;
  }
  if (awy1.magneticCourseOpposite !== undefined) {
    wp.magneticCourseOpposite = awy1.magneticCourseOpposite;
  }
  if (awy1.changeoverDistance !== undefined) {
    wp.changeoverDistance = awy1.changeoverDistance;
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
