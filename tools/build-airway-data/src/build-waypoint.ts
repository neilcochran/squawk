import type { AirwayDirection, AirwayWaypoint, AirwayWaypointType } from '@squawk/types';

import type { MagneticVariation } from './fields.js';
import { parseDms } from './fields.js';

/**
 * The point remark NASR used to mark an unusable segment before the MEA GAP
 * column existed; the current files still carry it, on some segments without
 * the flag.
 */
export const UNUSABLE_REMARK = 'UNUSABLE';

/**
 * The segment fields shared by an AWY1 and an ATS1 record: everything the FAA
 * publishes about the segment from a point to the next one.
 */
export interface AirwaySegmentRecord {
  /** Airway type character (blank, A, or H). */
  airwayTypeChar: string;
  /** Airway point sequence number. */
  sequenceNumber: number;
  /** Distance to next point in nautical miles from the header field. NASR writes `000.00` where none is published. */
  distanceToNextNm: number | undefined;
  /** Segment magnetic course. */
  magneticCourseDeg: number | undefined;
  /** Segment magnetic course - opposite direction. */
  magneticCourseOppositeDeg: number | undefined;
  /** Distance to next point in segment in nautical miles. NASR writes `000.00` where none is published. */
  segmentDistanceNm: number | undefined;
  /** MEA in feet. */
  minimumEnrouteAltitudeFt: number | undefined;
  /** MEA direction. */
  minimumEnrouteAltitudeDirection: AirwayDirection | undefined;
  /** MEA opposite direction altitude. */
  minimumEnrouteAltitudeOppositeFt: number | undefined;
  /** MEA opposite direction qualifier. */
  minimumEnrouteAltitudeOppositeDirection: AirwayDirection | undefined;
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
  minimumCrossingAltitudeDirection: AirwayDirection | undefined;
  /** MCA opposite direction altitude. */
  minimumCrossingAltitudeOppositeFt: number | undefined;
  /** MCA opposite direction qualifier. */
  minimumCrossingAltitudeOppositeDirection: AirwayDirection | undefined;
  /** Name or navaid identifier of the point the MCA applies at. */
  minimumCrossingAltitudePoint: string | undefined;
  /** Gap in signal coverage. */
  signalGap: boolean;
  /** US airspace only indicator. */
  usAirspaceOnly: boolean;
  /** Magnetic variation at the point, published on navaid points. */
  magneticVariation: MagneticVariation | undefined;
  /** ARTCC identifier. */
  artccId: string | undefined;
  /** GNSS MEA. */
  gnssMinimumEnrouteAltitudeFt: number | undefined;
  /** GNSS MEA direction. */
  gnssMinimumEnrouteAltitudeDirection: AirwayDirection | undefined;
  /** GNSS MEA opposite. */
  gnssMinimumEnrouteAltitudeOppositeFt: number | undefined;
  /** GNSS MEA opposite direction. */
  gnssMinimumEnrouteAltitudeOppositeDirection: AirwayDirection | undefined;
  /** DME/DME/IRU MEA. */
  dmeDmeIruMinimumEnrouteAltitudeFt: number | undefined;
  /** DME/DME/IRU MEA direction. */
  dmeDmeIruMinimumEnrouteAltitudeDirection: AirwayDirection | undefined;
  /** DME/DME/IRU MEA opposite. */
  dmeDmeIruMinimumEnrouteAltitudeOppositeFt: number | undefined;
  /** DME/DME/IRU MEA opposite direction. */
  dmeDmeIruMinimumEnrouteAltitudeOppositeDirection: AirwayDirection | undefined;
  /** Dogleg indicator. */
  dogleg: boolean;
  /** Required navigation performance in nautical miles. */
  rnpNm: number | undefined;
  /** Whether the MEA GAP column marks the segment unusable (`U`). */
  unusable: boolean;
}

/**
 * The point fields shared by an AWY2 and an ATS2 record.
 */
export interface AirwayPointRecord {
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
 * Picks the published distance from an airway point to the next one out of
 * the two NASR distance fields. The segment distance (`AWY1` column 69,
 * `ATS1` column 79) is the field the FAA populates and wins when it is
 * positive; the header distance (column 45 / 55) is the fallback. NASR writes
 * `000.00` rather than blanks where no leg follows - the last point of an
 * airway, or a gap - so a zero in either field means the distance is not
 * published, never that the leg has zero length.
 *
 * @param segmentDistanceNm - Distance to the next point in the segment, in nautical miles.
 * @param distanceToNextNm - Distance to the next point from the header field, in nautical miles.
 * @returns The first positive distance, or `undefined` when neither field is published.
 */
export function publishedDistanceNm(
  segmentDistanceNm: number | undefined,
  distanceToNextNm: number | undefined,
): number | undefined {
  if (segmentDistanceNm !== undefined && segmentDistanceNm > 0) {
    return segmentDistanceNm;
  }
  if (distanceToNextNm !== undefined && distanceToNextNm > 0) {
    return distanceToNextNm;
  }
  return undefined;
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

  return 'OTHER';
}

/**
 * Builds an AirwayWaypoint from a paired segment and point record plus the
 * point's remarks. Returns undefined when the point has no usable coordinates
 * (border crossings, for example), so the caller can drop it.
 *
 * Each altitude direction is emitted only with its altitude. The minimum
 * crossing altitude is not copied here: NASR publishes it on the segment
 * record and names the point it applies at, so `attachCrossingAltitudes`
 * places it once every waypoint of the airway is built. The distance to the
 * next point is left unset when the airway is discontinued after this point
 * (the gap flag), since the FAA's value then does not describe a leg to the
 * next waypoint.
 *
 * @param segment - The AWY1 / ATS1 record for the segment starting at the point.
 * @param point - The AWY2 / ATS2 record describing the point.
 * @param remarks - The point's AWY4 / ATS4 remark lines, in file order.
 * @returns The waypoint, or undefined when it cannot be placed.
 */
export function buildWaypoint(
  segment: AirwaySegmentRecord,
  point: AirwayPointRecord,
  remarks: readonly string[] = [],
): AirwayWaypoint | undefined {
  const lat = parseDms(point.latStr);
  const lon = parseDms(point.lonStr);

  if (lat === undefined || lon === undefined) {
    return undefined;
  }

  const waypointType = classifyWaypointType(point.facilityType, point.name);

  const wp: AirwayWaypoint = {
    name: point.name,
    waypointType,
    lat,
    lon,
  };

  if (point.navaidIdentifier) {
    wp.identifier = point.navaidIdentifier;
  } else if (waypointType === 'FIX' || waypointType === 'WAYPOINT') {
    wp.identifier = point.name;
  }

  if (waypointType === 'NAVAID' && point.facilityType) {
    wp.navaidFacilityType = point.facilityType;
  }
  if (point.state) {
    wp.state = point.state;
  }
  if (point.icaoRegionCode) {
    wp.icaoRegionCode = point.icaoRegionCode;
  }
  if (segment.artccId) {
    wp.artccId = segment.artccId;
  }
  if (point.minimumReceptionAltitudeFt !== undefined) {
    wp.minimumReceptionAltitudeFt = point.minimumReceptionAltitudeFt;
  }
  if (segment.magneticVariation !== undefined) {
    wp.magneticVariationDeg = segment.magneticVariation.degrees;
    wp.magneticVariationDirection = segment.magneticVariation.direction;
  }
  if (segment.minimumEnrouteAltitudeFt !== undefined) {
    wp.minimumEnrouteAltitudeFt = segment.minimumEnrouteAltitudeFt;
    if (segment.minimumEnrouteAltitudeDirection !== undefined) {
      wp.minimumEnrouteAltitudeDirection = segment.minimumEnrouteAltitudeDirection;
    }
  }
  if (segment.minimumEnrouteAltitudeOppositeFt !== undefined) {
    wp.minimumEnrouteAltitudeOppositeFt = segment.minimumEnrouteAltitudeOppositeFt;
    if (segment.minimumEnrouteAltitudeOppositeDirection !== undefined) {
      wp.minimumEnrouteAltitudeOppositeDirection = segment.minimumEnrouteAltitudeOppositeDirection;
    }
  }
  if (segment.maximumAuthorizedAltitudeFt !== undefined) {
    wp.maximumAuthorizedAltitudeFt = segment.maximumAuthorizedAltitudeFt;
  }
  if (segment.minimumObstructionClearanceAltitudeFt !== undefined) {
    wp.minimumObstructionClearanceAltitudeFt = segment.minimumObstructionClearanceAltitudeFt;
  }
  if (segment.gnssMinimumEnrouteAltitudeFt !== undefined) {
    wp.gnssMinimumEnrouteAltitudeFt = segment.gnssMinimumEnrouteAltitudeFt;
    if (segment.gnssMinimumEnrouteAltitudeDirection !== undefined) {
      wp.gnssMinimumEnrouteAltitudeDirection = segment.gnssMinimumEnrouteAltitudeDirection;
    }
  }
  if (segment.gnssMinimumEnrouteAltitudeOppositeFt !== undefined) {
    wp.gnssMinimumEnrouteAltitudeOppositeFt = segment.gnssMinimumEnrouteAltitudeOppositeFt;
    if (segment.gnssMinimumEnrouteAltitudeOppositeDirection !== undefined) {
      wp.gnssMinimumEnrouteAltitudeOppositeDirection =
        segment.gnssMinimumEnrouteAltitudeOppositeDirection;
    }
  }
  if (segment.dmeDmeIruMinimumEnrouteAltitudeFt !== undefined) {
    wp.dmeDmeIruMinimumEnrouteAltitudeFt = segment.dmeDmeIruMinimumEnrouteAltitudeFt;
    if (segment.dmeDmeIruMinimumEnrouteAltitudeDirection !== undefined) {
      wp.dmeDmeIruMinimumEnrouteAltitudeDirection =
        segment.dmeDmeIruMinimumEnrouteAltitudeDirection;
    }
  }
  if (segment.dmeDmeIruMinimumEnrouteAltitudeOppositeFt !== undefined) {
    wp.dmeDmeIruMinimumEnrouteAltitudeOppositeFt =
      segment.dmeDmeIruMinimumEnrouteAltitudeOppositeFt;
    if (segment.dmeDmeIruMinimumEnrouteAltitudeOppositeDirection !== undefined) {
      wp.dmeDmeIruMinimumEnrouteAltitudeOppositeDirection =
        segment.dmeDmeIruMinimumEnrouteAltitudeOppositeDirection;
    }
  }
  const distanceToNextNm = segment.discontinued
    ? undefined
    : publishedDistanceNm(segment.segmentDistanceNm, segment.distanceToNextNm);
  if (distanceToNextNm !== undefined) {
    wp.distanceToNextNm = distanceToNextNm;
  }
  if (segment.magneticCourseDeg !== undefined) {
    wp.magneticCourseDeg = segment.magneticCourseDeg;
  }
  if (segment.magneticCourseOppositeDeg !== undefined) {
    wp.magneticCourseOppositeDeg = segment.magneticCourseOppositeDeg;
  }
  if (segment.changeoverDistanceNm !== undefined) {
    wp.changeoverDistanceNm = segment.changeoverDistanceNm;
  }
  if (segment.rnpNm !== undefined) {
    wp.rnpNm = segment.rnpNm;
  }
  if (segment.signalGap) {
    wp.signalGap = true;
  }
  if (segment.usAirspaceOnly) {
    wp.usAirspaceOnly = true;
  }
  if (segment.dogleg) {
    wp.dogleg = true;
  }
  if (segment.discontinued) {
    wp.discontinued = true;
  }
  if (segment.unusable || remarks.includes(UNUSABLE_REMARK)) {
    wp.unusable = true;
  }
  if (remarks.length > 0) {
    wp.remarks = [...remarks];
  }

  return wp;
}
