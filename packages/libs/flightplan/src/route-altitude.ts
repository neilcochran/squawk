/**
 * Route altitude checking for parsed flight plan routes. Compares the cruise
 * altitude flown on each airway leg against the published minimum enroute
 * altitude (MEA) for the direction flown and the aircraft's navigation
 * equipment, and against the maximum authorized altitude (MAA), and checks
 * each airway fix against its minimum crossing altitude (MCA) and minimum
 * reception altitude (MRA).
 *
 * Legs and points come from the same walk as `computeRouteDistance` and
 * `extractRoutePoints`, so the results line up with those one-for-one.
 */

import type { AirwayDirection, AirwayWaypoint } from '@squawk/types';

import type { ParsedRoute, SpeedAltitudeRouteElement } from './resolver.js';
import { extractGeoPoints } from './route-geometry.js';
import type { AirwayPosition, GeoPoint } from './route-geometry.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A kind of navigation equipment that determines which published MEAs an
 * aircraft may use.
 *
 * - `conventional` - VOR (and other ground-based navaid) receivers. Uses the
 *   conventional MEA.
 * - `gnss` - IFR-approved GNSS. Uses the GNSS MEA where one is published and
 *   the conventional MEA otherwise, since a GNSS MEA is published only where
 *   it is lower. On US Jet and Q route segments that publish an MEA but no
 *   GNSS MEA, FL180 also applies, as the GNSS MEA on high altitude routes is
 *   FL180 unless published higher.
 * - `dmeDmeIru` - DME/DME/IRU RNAV. Uses only the DME/DME/IRU MEA, since the
 *   conventional MEA does not assure DME/DME coverage.
 */
export type NavigationEquipment = 'conventional' | 'gnss' | 'dmeDmeIru';

/**
 * Options for {@link checkRouteAltitudes}.
 */
export interface RouteAltitudeCheckOptions {
  /**
   * Cruise altitude in feet. A flight level counts as hundreds of feet
   * (FL350 is 35000). Replaces the route's opening speed/altitude group, if
   * any; speed/altitude groups attached to later route points still change
   * the altitude from their point onward. Omit to use the route's own groups.
   */
  altitudeFt?: number;
  /**
   * The navigation equipment aboard, at least one kind. The applicable MEA is
   * the lowest one usable with any of them.
   */
  equipment: readonly [NavigationEquipment, ...NavigationEquipment[]];
}

/**
 * The outcome of checking a leg or point.
 *
 * - `pass` - every applicable altitude is met.
 * - `fail` - an altitude is not met, or the leg may not be flown as filed.
 * - `notDeterminable` - the check could not be made (no altitude, no
 *   published MEA for the equipment, not an airway leg, and so on).
 */
export type RouteAltitudeStatus = 'pass' | 'fail' | 'notDeterminable';

/**
 * The overall outcome of a route altitude check: the worst status across all
 * legs and points, or `noAltitude` when neither the options nor the route
 * give any altitude.
 */
export type RouteAltitudeCheckStatus = RouteAltitudeStatus | 'noAltitude';

/**
 * What a finding reports.
 *
 * - `belowMea` - the altitude is below the applicable MEA.
 * - `aboveMaa` - the altitude is above the MAA.
 * - `belowMca` - the point is crossed below its applicable MCA.
 * - `belowMra` - the point is crossed below its MRA.
 * - `mcaNotApplicable` - the point publishes an MCA whose direction matches
 *   neither direction of travel along the airway, so it is not applied.
 * - `unusableSegment` - the leg is an airway segment the FAA marks unusable.
 * - `acrossGap` - the leg spans a published gap in its airway.
 * - `noAltitude` - no altitude is known for the leg or point.
 * - `noPublishedMea` - the airway segment publishes no MEA of any kind.
 * - `noMeaForEquipment` - the segment publishes MEAs, but none the
 *   equipment may use.
 * - `noPublishedCourse` - picking a directional value needs the segment's
 *   course, which is not published.
 * - `airwayDirectionUnknown` - the airway lookup did not report which way
 *   the airway is flown, so the segment's published values cannot be read.
 * - `notOnAirway` - the leg is not an airway segment (direct, coordinate or
 *   procedure leg), so no published enroute altitude applies.
 */
export type RouteAltitudeFindingCode =
  | 'belowMea'
  | 'aboveMaa'
  | 'belowMca'
  | 'belowMra'
  | 'mcaNotApplicable'
  | 'unusableSegment'
  | 'acrossGap'
  | 'noAltitude'
  | 'noPublishedMea'
  | 'noMeaForEquipment'
  | 'noPublishedCourse'
  | 'airwayDirectionUnknown'
  | 'notOnAirway';

/**
 * How a finding affects the status of its leg or point: a `fail` finding
 * makes it `fail`; otherwise a `notDeterminable` finding makes it
 * `notDeterminable`; an `info` finding leaves the status unchanged.
 */
export type RouteAltitudeFindingKind = 'fail' | 'notDeterminable' | 'info';

/**
 * A single reason behind a leg's or point's status.
 */
export interface RouteAltitudeFinding {
  /** What the finding reports. */
  code: RouteAltitudeFindingCode;
  /** How the finding affects the status. */
  kind: RouteAltitudeFindingKind;
  /** Human-readable explanation with the values involved. */
  message: string;
}

/**
 * Where the altitude of a leg comes from: the `altitudeFt` option, or a
 * speed/altitude group in the route.
 */
export type RouteAltitudeSource =
  | {
      /** The altitude is the `altitudeFt` option. */
      type: 'input';
    }
  | {
      /** The altitude comes from a speed/altitude group in the route. */
      type: 'route';
      /** The group as it appears in the route string (e.g. "N0450F370"). */
      raw: string;
      /** The route point the group is attached to; absent on a standalone group. */
      fromPoint?: string;
    };

/**
 * The MEA kind an applicable MEA was taken from.
 */
export type MinimumEnrouteAltitudeKind = 'conventional' | 'gnss' | 'dmeDmeIru';

/**
 * The MEA that applies to a leg for the direction flown and the equipment.
 */
export interface ApplicableMinimumEnrouteAltitude {
  /** The MEA in feet. */
  altitudeFt: number;
  /** The MEA kind the value was taken from. */
  kind: MinimumEnrouteAltitudeKind;
  /** The published direction the value applies to; absent when it applies both ways. */
  direction?: AirwayDirection;
  /**
   * `published` when the value is published for the segment;
   * `highRouteGnssDefault` when it is the FL180 GNSS MEA that applies on
   * US Jet and Q route segments publishing no GNSS MEA of their own.
   */
  basis: 'published' | 'highRouteGnssDefault';
}

/**
 * The MCA that applies at a point for the direction flown.
 */
export interface ApplicableMinimumCrossingAltitude {
  /** The MCA in feet. */
  altitudeFt: number;
  /** The published direction of travel the MCA applies to; absent when it applies both ways. */
  direction?: AirwayDirection;
  /** Designation of the airway that publishes the MCA. */
  airway: string;
}

/**
 * The altitude check for one leg between two consecutive route points. The
 * leg at index `i` runs from `points[i]` to `points[i + 1]` and matches leg
 * `i` of `computeRouteDistance`.
 */
export interface RouteAltitudeLeg {
  /** Identifier or raw token of the starting point. */
  from: string;
  /** Identifier or raw token of the ending point. */
  to: string;
  /** Designation of the airway the leg runs along; absent when it is not an airway segment. */
  airway?: string;
  /** The altitude flown on the leg in feet; absent when none is known. */
  altitudeFt?: number;
  /** Where `altitudeFt` comes from; absent when none is known. */
  altitudeSource?: RouteAltitudeSource;
  /** The outcome of the leg's check. */
  status: RouteAltitudeStatus;
  /** The reasons behind `status`, plus any informational notes. */
  findings: RouteAltitudeFinding[];
  /** The MEA applied to the leg, when one could be determined. */
  minimumEnrouteAltitude?: ApplicableMinimumEnrouteAltitude;
  /** The segment's MAA in feet, when published. */
  maximumAuthorizedAltitudeFt?: number;
}

/**
 * The altitude check for one route point. Matches the point at the same
 * index of `extractRoutePoints`.
 */
export interface RouteAltitudePoint {
  /** Display label (identifier or raw token) for the point. */
  label: string;
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
  /**
   * The altitude the point is crossed at in feet: that of the leg arriving
   * at it (a speed/altitude group attached to the point takes effect after
   * it), or that of the first leg at the route's first point. Absent when
   * none is known.
   */
  altitudeFt?: number;
  /** The outcome of the point's check. */
  status: RouteAltitudeStatus;
  /** The reasons behind `status`, plus any informational notes. */
  findings: RouteAltitudeFinding[];
  /** The highest MCA that applies at the point for the direction flown, when any does. */
  minimumCrossingAltitude?: ApplicableMinimumCrossingAltitude;
  /** The MRA at the point in feet, when published (the highest, if two airways publish one). */
  minimumReceptionAltitudeFt?: number;
  /** FAA remarks about the point from the airways that pass through it, one per published line. */
  remarks?: string[];
}

/**
 * The FAA remarks about a whole airway the route flies along.
 */
export interface RouteAltitudeAirwayRemarks {
  /** Airway designation. */
  airway: string;
  /** FAA remarks about the route, one per published line. */
  remarks: string[];
}

/**
 * The result of {@link checkRouteAltitudes}.
 */
export interface RouteAltitudeCheckResult {
  /** The worst status across all legs and points, or `noAltitude` when no altitude is known anywhere. */
  status: RouteAltitudeCheckStatus;
  /** One check per leg, in route order. Empty when `status` is `noAltitude`. */
  legs: RouteAltitudeLeg[];
  /** One check per route point, in route order. Empty when `status` is `noAltitude`. */
  points: RouteAltitudePoint[];
  /** Remarks about each airway the route flies along that publishes any, in route order. Empty when `status` is `noAltitude`. */
  airwayRemarks: RouteAltitudeAirwayRemarks[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Altitude in feet of the GNSS MEA on high altitude routes that publish no GNSS MEA. */
const HIGH_ROUTE_GNSS_MEA_FT = 18000;

/**
 * Largest angle in degrees between a published direction and a course for
 * the direction to count as matching the course: the direction's own 45-deg
 * sector plus the adjacent one.
 */
const DIRECTION_MATCH_LIMIT_DEG = 67.5;

/** Compass bearing in degrees of each published direction. */
const DIRECTION_DEG: Record<AirwayDirection, number> = {
  'N BND': 0,
  'NE BND': 45,
  'E BND': 90,
  'SE BND': 135,
  'S BND': 180,
  'SW BND': 225,
  'W BND': 270,
  'NW BND': 315,
};

/** Status precedence, worst last. */
const STATUS_RANK: Record<RouteAltitudeStatus, number> = {
  pass: 0,
  notDeterminable: 1,
  fail: 2,
};

/** An altitude with where it came from. */
interface SourcedAltitude {
  /** Altitude in feet. */
  altitudeFt: number;
  /** Where the altitude comes from. */
  source: RouteAltitudeSource;
}

/** A published value with the direction it applies to. */
interface DirectionalValue {
  /** The value in feet. */
  altitudeFt: number;
  /** The direction it applies to; absent when it applies both ways. */
  direction?: AirwayDirection;
}

/**
 * Returns the smallest angle in degrees between two bearings.
 */
function angleBetween(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Formats an altitude in feet for a finding message.
 */
function ft(altitudeFt: number): string {
  return `${altitudeFt} ft`;
}

/**
 * Formats an optional direction as a suffix to an altitude (" E BND").
 */
function directionSuffix(direction: AirwayDirection | undefined): string {
  return direction === undefined ? '' : ` ${direction}`;
}

/**
 * Converts a speed/altitude group to an altitude, or undefined when the
 * group carries none.
 */
function groupAltitude(group: SpeedAltitudeRouteElement): SourcedAltitude | undefined {
  const altitudeFt = group.flightLevel !== undefined ? group.flightLevel * 100 : group.altitudeFt;
  if (altitudeFt === undefined) {
    return undefined;
  }
  const source: RouteAltitudeSource = { type: 'route', raw: group.raw };
  if (group.fromPoint !== undefined) {
    source.fromPoint = group.fromPoint;
  }
  return { altitudeFt, source };
}

/**
 * Returns the waypoint record that carries a segment's published values and
 * the magnetic course flown along it, or undefined when the airway lookup
 * did not report which way the airway is flown.
 */
function segmentRecord(
  position: AirwayPosition,
): { record: AirwayWaypoint; courseDeg: number | undefined } | undefined {
  const { element, index } = position;
  if (element.reversed === undefined) {
    return undefined;
  }
  if (element.reversed) {
    const record = element.waypoints[index + 1]!;
    return { record, courseDeg: record.magneticCourseOppositeDeg };
  }
  const record = element.waypoints[index]!;
  return { record, courseDeg: record.magneticCourseDeg };
}

/**
 * Picks the value of a directional pair that applies to a course. A value
 * without a direction, or a single value with no opposite, applies both
 * ways. Returns `needsCourse` when a pair must be resolved but the course is
 * unknown, and undefined when nothing is published.
 */
function pickDirectional(
  primaryFt: number | undefined,
  primaryDirection: AirwayDirection | undefined,
  oppositeFt: number | undefined,
  oppositeDirection: AirwayDirection | undefined,
  courseDeg: number | undefined,
): DirectionalValue | 'needsCourse' | undefined {
  const candidates: DirectionalValue[] = [];
  if (primaryFt !== undefined) {
    candidates.push(
      primaryDirection === undefined
        ? { altitudeFt: primaryFt }
        : { altitudeFt: primaryFt, direction: primaryDirection },
    );
  }
  if (oppositeFt !== undefined) {
    candidates.push(
      oppositeDirection === undefined
        ? { altitudeFt: oppositeFt }
        : { altitudeFt: oppositeFt, direction: oppositeDirection },
    );
  }
  const [first, second] = candidates;
  if (first === undefined) {
    return undefined;
  }
  if (second === undefined) {
    return first;
  }
  if (first.direction === undefined || second.direction === undefined) {
    return first.direction === undefined ? first : second;
  }
  if (courseDeg === undefined) {
    return 'needsCourse';
  }
  const firstAngle = angleBetween(DIRECTION_DEG[first.direction], courseDeg);
  const secondAngle = angleBetween(DIRECTION_DEG[second.direction], courseDeg);
  return firstAngle <= secondAngle ? first : second;
}

/**
 * Determines the MEA that applies to a segment for the equipment, or the
 * finding that explains why none can be determined.
 */
function applicableMea(
  position: AirwayPosition,
  record: AirwayWaypoint,
  courseDeg: number | undefined,
  equipment: ReadonlySet<NavigationEquipment>,
): ApplicableMinimumEnrouteAltitude | RouteAltitudeFinding {
  const conventional = pickDirectional(
    record.minimumEnrouteAltitudeFt,
    record.minimumEnrouteAltitudeDirection,
    record.minimumEnrouteAltitudeOppositeFt,
    record.minimumEnrouteAltitudeOppositeDirection,
    courseDeg,
  );
  const gnss = pickDirectional(
    record.gnssMinimumEnrouteAltitudeFt,
    record.gnssMinimumEnrouteAltitudeDirection,
    record.gnssMinimumEnrouteAltitudeOppositeFt,
    record.gnssMinimumEnrouteAltitudeOppositeDirection,
    courseDeg,
  );
  const dmeDmeIru = pickDirectional(
    record.dmeDmeIruMinimumEnrouteAltitudeFt,
    record.dmeDmeIruMinimumEnrouteAltitudeDirection,
    undefined,
    undefined,
    courseDeg,
  );

  if (conventional === undefined && gnss === undefined && dmeDmeIru === undefined) {
    return {
      code: 'noPublishedMea',
      kind: 'notDeterminable',
      message: 'The airway segment publishes no MEA.',
    };
  }

  const candidates: (ApplicableMinimumEnrouteAltitude | 'needsCourse')[] = [];
  function addPublished(
    value: DirectionalValue | 'needsCourse' | undefined,
    kind: MinimumEnrouteAltitudeKind,
  ): void {
    if (value === undefined) {
      return;
    }
    if (value === 'needsCourse') {
      candidates.push(value);
      return;
    }
    candidates.push({ ...value, kind, basis: 'published' });
  }

  if (equipment.has('conventional')) {
    addPublished(conventional, 'conventional');
  }
  if (equipment.has('gnss')) {
    if (gnss !== undefined) {
      addPublished(gnss, 'gnss');
    } else {
      addPublished(conventional, 'conventional');
      const { airway } = position.element;
      if (airway.region === 'US' && (airway.type === 'JET' || airway.type === 'RNAV_Q')) {
        candidates.push({
          altitudeFt: HIGH_ROUTE_GNSS_MEA_FT,
          kind: 'gnss',
          basis: 'highRouteGnssDefault',
        });
      }
    }
  }
  if (equipment.has('dmeDmeIru')) {
    addPublished(dmeDmeIru, 'dmeDmeIru');
  }

  if (candidates.includes('needsCourse')) {
    return {
      code: 'noPublishedCourse',
      kind: 'notDeterminable',
      message:
        'The segment publishes a different MEA for each direction but no course to pick one by.',
    };
  }
  let lowest: ApplicableMinimumEnrouteAltitude | undefined;
  for (const candidate of candidates) {
    if (
      candidate !== 'needsCourse' &&
      (lowest === undefined || candidate.altitudeFt < lowest.altitudeFt)
    ) {
      lowest = candidate;
    }
  }
  if (lowest === undefined) {
    return {
      code: 'noMeaForEquipment',
      kind: 'notDeterminable',
      message: 'The airway segment publishes no MEA usable with the given equipment.',
    };
  }
  return lowest;
}

/**
 * Returns the magnetic course flown along an airway at one of its expansion
 * waypoints: the course leaving it, or the course arriving at the airway's
 * last waypoint. Undefined when unknown.
 */
function courseAtFix(position: AirwayPosition): number | undefined {
  const { element, index } = position;
  const segmentIndex = index < element.waypoints.length - 1 ? index : index - 1;
  if (segmentIndex < 0) {
    return undefined;
  }
  return segmentRecord({ element, index: segmentIndex })?.courseDeg;
}

/**
 * Determines the MCA an airway fix applies to the direction flown. Returns
 * undefined when the fix publishes none for this direction, or a finding when
 * the MCA cannot be matched to the route.
 */
function applicableMca(
  position: AirwayPosition,
): ApplicableMinimumCrossingAltitude | RouteAltitudeFinding | undefined {
  const waypoint = position.element.waypoints[position.index]!;
  const airway = position.element.airway.designation;
  const values: DirectionalValue[] = [];
  if (waypoint.minimumCrossingAltitudeFt !== undefined) {
    values.push(
      waypoint.minimumCrossingAltitudeDirection === undefined
        ? { altitudeFt: waypoint.minimumCrossingAltitudeFt }
        : {
            altitudeFt: waypoint.minimumCrossingAltitudeFt,
            direction: waypoint.minimumCrossingAltitudeDirection,
          },
    );
  }
  if (waypoint.minimumCrossingAltitudeOppositeFt !== undefined) {
    values.push(
      waypoint.minimumCrossingAltitudeOppositeDirection === undefined
        ? { altitudeFt: waypoint.minimumCrossingAltitudeOppositeFt }
        : {
            altitudeFt: waypoint.minimumCrossingAltitudeOppositeFt,
            direction: waypoint.minimumCrossingAltitudeOppositeDirection,
          },
    );
  }
  const [first, second] = values;
  if (first === undefined) {
    return undefined;
  }
  if (
    first.direction === undefined ||
    (second !== undefined && second.altitudeFt === first.altitudeFt)
  ) {
    return { altitudeFt: first.altitudeFt, airway };
  }

  const courseDeg = courseAtFix(position);
  if (courseDeg === undefined) {
    return {
      code: 'noPublishedCourse',
      kind: 'notDeterminable',
      message: `${airway} publishes a directional MCA here but no course to match it to.`,
    };
  }
  let applicable: { value: DirectionalValue; angle: number } | undefined;
  let matchesReverse = false;
  for (const value of values) {
    if (value.direction === undefined) {
      return { altitudeFt: value.altitudeFt, airway };
    }
    const angle = angleBetween(DIRECTION_DEG[value.direction], courseDeg);
    if (angle <= DIRECTION_MATCH_LIMIT_DEG) {
      if (applicable === undefined || angle < applicable.angle) {
        applicable = { value, angle };
      }
    } else if (180 - angle <= DIRECTION_MATCH_LIMIT_DEG) {
      matchesReverse = true;
    }
  }
  if (applicable !== undefined) {
    const result: ApplicableMinimumCrossingAltitude = {
      altitudeFt: applicable.value.altitudeFt,
      airway,
    };
    if (applicable.value.direction !== undefined) {
      result.direction = applicable.value.direction;
    }
    return result;
  }
  if (matchesReverse) {
    return undefined;
  }
  const published = values
    .map((value) => `${ft(value.altitudeFt)}${directionSuffix(value.direction)}`)
    .join(', ');
  return {
    code: 'mcaNotApplicable',
    kind: 'info',
    message: `${airway} publishes an MCA of ${published} here whose direction matches neither direction of travel along the airway, so it is not applied.`,
  };
}

/**
 * Derives a status from findings: `fail` if any fails, else
 * `notDeterminable` if any cannot be determined, else `pass`.
 */
function statusOf(findings: RouteAltitudeFinding[]): RouteAltitudeStatus {
  if (findings.some((finding) => finding.kind === 'fail')) {
    return 'fail';
  }
  if (findings.some((finding) => finding.kind === 'notDeterminable')) {
    return 'notDeterminable';
  }
  return 'pass';
}

/**
 * Checks one leg from a point to the next.
 */
function checkLeg(
  from: GeoPoint,
  to: GeoPoint,
  altitude: SourcedAltitude | undefined,
  equipment: ReadonlySet<NavigationEquipment>,
): RouteAltitudeLeg {
  const findings: RouteAltitudeFinding[] = [];
  const leg: RouteAltitudeLeg = {
    from: from.label,
    to: to.label,
    status: 'pass',
    findings,
  };
  if (altitude !== undefined) {
    leg.altitudeFt = altitude.altitudeFt;
    leg.altitudeSource = altitude.source;
  }

  const position = from.airwaySegmentToNext;
  if (position === undefined) {
    findings.push({
      code: 'notOnAirway',
      kind: 'notDeterminable',
      message: 'The leg is not an airway segment, so no published enroute altitude applies.',
    });
    leg.status = statusOf(findings);
    return leg;
  }
  leg.airway = position.element.airway.designation;

  if (from.gapToNext === true) {
    findings.push({
      code: 'acrossGap',
      kind: 'fail',
      message: `${leg.airway} is not defined between ${leg.from} and ${leg.to}: the leg spans a published gap.`,
    });
  }
  if (from.unusableToNext === true) {
    findings.push({
      code: 'unusableSegment',
      kind: 'fail',
      message: `The FAA marks ${leg.airway} ${leg.from}-${leg.to} unusable.`,
    });
  }
  if (findings.length > 0) {
    leg.status = statusOf(findings);
    return leg;
  }

  const segment = segmentRecord(position);
  if (segment === undefined) {
    findings.push({
      code: 'airwayDirectionUnknown',
      kind: 'notDeterminable',
      message: `Which way ${leg.airway} is flown is unknown, so its published altitudes cannot be read.`,
    });
    leg.status = statusOf(findings);
    return leg;
  }

  const mea = applicableMea(position, segment.record, segment.courseDeg, equipment);
  if ('code' in mea) {
    findings.push(mea);
  } else {
    leg.minimumEnrouteAltitude = mea;
  }
  const maa = segment.record.maximumAuthorizedAltitudeFt;
  if (maa !== undefined) {
    leg.maximumAuthorizedAltitudeFt = maa;
  }

  if (altitude === undefined) {
    findings.push({
      code: 'noAltitude',
      kind: 'notDeterminable',
      message: 'No altitude is known for the leg.',
    });
  } else {
    if (
      leg.minimumEnrouteAltitude !== undefined &&
      altitude.altitudeFt < leg.minimumEnrouteAltitude.altitudeFt
    ) {
      const { altitudeFt, kind, direction, basis } = leg.minimumEnrouteAltitude;
      const label = basis === 'highRouteGnssDefault' ? 'GNSS high altitude route' : kind;
      findings.push({
        code: 'belowMea',
        kind: 'fail',
        message: `${ft(altitude.altitudeFt)} is below the ${label} MEA of ${ft(altitudeFt)}${directionSuffix(direction)}.`,
      });
    }
    if (maa !== undefined && altitude.altitudeFt > maa) {
      findings.push({
        code: 'aboveMaa',
        kind: 'fail',
        message: `${ft(altitude.altitudeFt)} is above the MAA of ${ft(maa)}.`,
      });
    }
  }
  leg.status = statusOf(findings);
  return leg;
}

/**
 * Checks one route point against the MCAs and MRAs of the airways through it.
 */
function checkPoint(
  point: GeoPoint,
  altitudeFt: number | undefined,
  conventionalOnly: boolean,
): RouteAltitudePoint {
  const findings: RouteAltitudeFinding[] = [];
  const result: RouteAltitudePoint = {
    label: point.label,
    lat: point.lat,
    lon: point.lon,
    status: 'pass',
    findings,
  };
  if (altitudeFt !== undefined) {
    result.altitudeFt = altitudeFt;
  }

  const remarks: string[] = [];
  let altitudeNeeded = false;
  for (const position of point.airwayFixes ?? []) {
    const waypoint = position.element.waypoints[position.index]!;
    for (const remark of waypoint.remarks ?? []) {
      if (!remarks.includes(remark)) {
        remarks.push(remark);
      }
    }

    const mca = applicableMca(position);
    if (mca !== undefined) {
      if ('code' in mca) {
        findings.push(mca);
      } else if (
        result.minimumCrossingAltitude === undefined ||
        mca.altitudeFt > result.minimumCrossingAltitude.altitudeFt
      ) {
        result.minimumCrossingAltitude = mca;
      }
    }

    const mra = waypoint.minimumReceptionAltitudeFt;
    if (
      mra !== undefined &&
      (result.minimumReceptionAltitudeFt === undefined || mra > result.minimumReceptionAltitudeFt)
    ) {
      result.minimumReceptionAltitudeFt = mra;
    }
  }
  if (remarks.length > 0) {
    result.remarks = remarks;
  }

  const mca = result.minimumCrossingAltitude;
  if (mca !== undefined) {
    altitudeNeeded = true;
    if (altitudeFt !== undefined && altitudeFt < mca.altitudeFt) {
      findings.push({
        code: 'belowMca',
        kind: 'fail',
        message: `${ft(altitudeFt)} is below the ${mca.airway} MCA of ${ft(mca.altitudeFt)}${directionSuffix(mca.direction)}.`,
      });
    }
  }
  const mra = result.minimumReceptionAltitudeFt;
  if (mra !== undefined) {
    altitudeNeeded ||= conventionalOnly;
    if (altitudeFt !== undefined && altitudeFt < mra) {
      findings.push({
        code: 'belowMra',
        kind: conventionalOnly ? 'fail' : 'info',
        message: conventionalOnly
          ? `${ft(altitudeFt)} is below the MRA of ${ft(mra)}, so the navaid signals that identify the point may not be received.`
          : `${ft(altitudeFt)} is below the MRA of ${ft(mra)}; this affects only conventional navigation.`,
      });
    }
  }
  if (altitudeNeeded && altitudeFt === undefined) {
    findings.push({
      code: 'noAltitude',
      kind: 'notDeterminable',
      message: 'No altitude is known for crossing the point.',
    });
  }
  result.status = statusOf(findings);
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Checks a parsed route's cruise altitude against the published airway
 * altitudes: on each airway leg, the MEA for the direction flown and the
 * equipment, and the MAA; at each airway fix, the MCA for the direction
 * flown and the MRA.
 *
 * The altitude flown starts at `options.altitudeFt`, or else the route's
 * opening speed/altitude group, and changes at each speed/altitude group
 * attached to a later route point, from that point onward. A flight level
 * counts as hundreds of feet. When no altitude is known anywhere the result
 * is `noAltitude` with no legs or points.
 *
 * The applicable MEA is the lowest usable with any of the equipment (see
 * {@link NavigationEquipment}). Where the conventional and GNSS MEAs differ
 * by direction, the published direction closest to the leg's magnetic course
 * applies. An MCA applies when its direction is within 67.5 deg of the course
 * leaving the fix (or arriving at the airway's last fix), or in both
 * directions when the two published values are equal. Falling below an MRA
 * fails only for conventional-only equipment. Legs that span a published gap
 * or run along an unusable segment fail as filed. Legs that are not airway
 * segments (direct, coordinate and procedure legs) cannot be determined.
 *
 * Flight below the MEA down to the MOCA, the cruising altitude for the
 * direction of flight, and procedure altitude constraints are not checked.
 *
 * ```typescript
 * import { createFlightplanResolver, checkRouteAltitudes } from '@squawk/flightplan';
 *
 * const resolver = createFlightplanResolver({ airports, navaids, fixes, airways });
 * const route = resolver.parse('KBOS DCT BOS V16 JFK DCT KJFK');
 * const result = checkRouteAltitudes(route, { altitudeFt: 7000, equipment: ['gnss'] });
 * console.log(result.status);
 * ```
 *
 * @param route - A parsed route from {@link FlightplanResolver.parse}.
 * @param options - The cruise altitude and the navigation equipment aboard.
 * @returns Per-leg and per-point altitude checks and the overall status.
 */
export function checkRouteAltitudes(
  route: ParsedRoute,
  options: RouteAltitudeCheckOptions,
): RouteAltitudeCheckResult {
  const { points, leadingSpeedAltitudes } = extractGeoPoints(route.elements);
  const equipment = new Set<NavigationEquipment>(options.equipment);
  const conventionalOnly = equipment.size === 1 && equipment.has('conventional');

  let initial: SourcedAltitude | undefined;
  if (options.altitudeFt !== undefined) {
    initial = { altitudeFt: options.altitudeFt, source: { type: 'input' } };
  } else {
    for (const group of leadingSpeedAltitudes) {
      initial = groupAltitude(group) ?? initial;
    }
  }

  // The altitude flown on the leg leaving each point.
  const altitudeAfter: (SourcedAltitude | undefined)[] = [];
  let current = initial;
  for (const point of points) {
    for (const group of point.speedAltitudeChanges ?? []) {
      current = groupAltitude(group) ?? current;
    }
    altitudeAfter.push(current);
  }

  if (initial === undefined && altitudeAfter.every((altitude) => altitude === undefined)) {
    return { status: 'noAltitude', legs: [], points: [], airwayRemarks: [] };
  }

  const airwayRemarks: RouteAltitudeAirwayRemarks[] = [];
  for (const element of route.elements) {
    const remarks = element.type === 'airway' ? element.airway.remarks : undefined;
    if (element.type === 'airway' && remarks !== undefined && remarks.length > 0) {
      const designation = element.airway.designation;
      if (!airwayRemarks.some((entry) => entry.airway === designation)) {
        airwayRemarks.push({ airway: designation, remarks: [...remarks] });
      }
    }
  }

  const legs: RouteAltitudeLeg[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    legs.push(checkLeg(points[i]!, points[i + 1]!, altitudeAfter[i], equipment));
  }

  const pointResults = points.map((point, i) => {
    const crossing = i === 0 ? (initial ?? altitudeAfter[0]) : altitudeAfter[i - 1];
    return checkPoint(point, crossing?.altitudeFt, conventionalOnly);
  });

  let status: RouteAltitudeStatus = 'pass';
  for (const result of [...legs, ...pointResults]) {
    if (STATUS_RANK[result.status] > STATUS_RANK[status]) {
      status = result.status;
    }
  }

  return { status, legs, points: pointResults, airwayRemarks };
}
