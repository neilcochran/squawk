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

import { magnetic } from '@squawk/flight-math';
import { greatCircle } from '@squawk/geo';
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
 * - `belowMea` - the altitude is below the applicable MEA, and no MOCA
 *   allows it (none is published, or the equipment has no allowance).
 * - `belowMoca` - the altitude is below the applicable MEA and the MOCA.
 * - `mocaAllowance` - the altitude is below the applicable MEA but at or
 *   above the MOCA, which the equipment may use (see `belowMeaAllowance`).
 * - `mocaBeyondVorRange` - the altitude is below the applicable MEA but at or
 *   above the MOCA, and the equipment may use the MOCA only within 22 NM of
 *   the VOR it navigates by, which the leg goes beyond (or the airway has no
 *   VOR to navigate the leg by).
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
  | 'belowMoca'
  | 'mocaAllowance'
  | 'mocaBeyondVorRange'
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
 * Why a leg may be flown below its applicable MEA, down to the MOCA, under
 * 14 CFR 91.177(a)(2)(ii) and FAA Order JO 7110.65 4-5-6a.
 */
export interface BelowMeaAllowance {
  /**
   * `gnss` when the equipment includes GNSS, which may use the MOCA anywhere
   * on the segment; `vorWithin22Nm` when it navigates by VOR and every point
   * of the leg is within 22 NM of the VOR it navigates by.
   */
  basis: 'gnss' | 'vorWithin22Nm';
  /** The MOCA in feet. */
  altitudeFt: number;
  /** Identifiers of the VORs the leg is navigated by, on a `vorWithin22Nm` allowance. */
  vors?: string[];
  /** Cautions that come with flying below the MEA. */
  cautions: string[];
}

/**
 * Whether a leg's altitude suits its direction of flight under the
 * east/west rule of 14 CFR 91.179(b).
 *
 * - `appropriate` - a cruising altitude for the direction flown.
 * - `inappropriate` - not a cruising altitude for the direction flown.
 * - `notDeterminable` - no altitude is known, or the leg is part of a SID or
 *   STAR, where the aircraft is climbing or descending.
 */
export type CruisingAltitudeStatus = 'appropriate' | 'inappropriate' | 'notDeterminable';

/**
 * The cruising altitude check for one leg. Advisory only: it does not affect
 * the leg's or the route's `status`, since ATC assigns altitudes in
 * controlled airspace and some routes publish altitudes against the rule.
 */
export interface CruisingAltitudeCheck {
  /** The outcome of the check. */
  status: CruisingAltitudeStatus;
  /** Human-readable explanation with the values involved. */
  message: string;
  /** The magnetic course the direction of flight was taken from, in degrees; absent when not needed. */
  magneticCourseDeg?: number;
  /**
   * `published` when `magneticCourseDeg` is the airway segment's published
   * course in the direction flown; `computed` when it is the leg's initial
   * great-circle true course converted to magnetic with the World Magnetic
   * Model.
   */
  courseSource?: 'published' | 'computed';
  /** `eastbound` for a magnetic course of 0 to 179 deg, `westbound` for 180 to 359 deg. */
  direction?: 'eastbound' | 'westbound';
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
  /** The segment's MOCA in feet, when published. */
  minimumObstructionClearanceAltitudeFt?: number;
  /** Why the leg may be flown below its MEA down to the MOCA, when it is. */
  belowMeaAllowance?: BelowMeaAllowance;
  /** Whether the altitude suits the direction of flight; advisory only. */
  cruisingAltitude: CruisingAltitudeCheck;
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

/** Distance in NM from a VOR within which the MOCA applies to aircraft navigating by it. */
const MOCA_VOR_LIMIT_NM = 22;

/** Longest spacing in NM between the points sampled along a leg to measure its distance from a VOR. */
const MOCA_SAMPLE_SPACING_NM = 1;

/** Navaid facility types that count as a VOR for the MOCA allowance. */
const VOR_FACILITY_TYPES: ReadonlySet<string> = new Set(['VOR', 'VOR/DME', 'VORTAC', 'TACAN']);

/** Cautions that come with flying below the MEA, from FAA Order JO 7110.65 4-5-6a. */
const BELOW_MEA_CAUTIONS = [
  'Communications are not assured below the MEA.',
  'On a radio or navigation failure, climb to the MEA for the segment.',
];

/**
 * Returns an airway waypoint's identifier, or its name when it has none.
 */
function waypointLabel(waypoint: AirwayWaypoint): string {
  return waypoint.identifier ?? waypoint.name;
}

/**
 * Whether an airway waypoint is a VOR, VOR/DME, VORTAC or TACAN.
 */
function isVor(waypoint: AirwayWaypoint): boolean {
  return (
    waypoint.waypointType === 'NAVAID' &&
    waypoint.navaidFacilityType !== undefined &&
    VOR_FACILITY_TYPES.has(waypoint.navaidFacilityType)
  );
}

/** How far an airway leg strays from the VORs it is navigated by. */
interface VorCoverage {
  /** Identifiers of the VORs the leg is navigated by, in published airway order. */
  vors: string[];
  /** The greatest distance in NM from any point of the leg to the VOR it is navigated by. */
  farthestNm: number;
  /** Identifier of the VOR at `farthestNm`. */
  farthestVor: string;
}

/**
 * Measures how far an airway leg strays from the VORs it is navigated by:
 * the nearest VOR along the airway behind the leg and ahead of it (not
 * across a published gap), with the changeover point between them where the
 * VOR publishes one and the midpoint otherwise. Reads the whole airway when
 * the expansion's waypoints are the airway's own, and the expansion alone
 * otherwise. Returns undefined when no VOR is found either way.
 */
function vorCoverage(position: AirwayPosition): VorCoverage | undefined {
  const { element, index } = position;
  const reversed = element.reversed === true;
  const segmentStart = element.waypoints[reversed ? index + 1 : index]!;
  const segmentEnd = element.waypoints[reversed ? index : index + 1]!;

  // The airway in published order, and the index in it where the segment starts.
  let line = element.airway.waypoints;
  let start = line.indexOf(segmentStart);
  if (start < 0 || line[start + 1] !== segmentEnd) {
    line = reversed ? [...element.waypoints].reverse() : element.waypoints;
    start = reversed ? element.waypoints.length - 2 - index : index;
  }

  const along = [0];
  for (let k = 0; k < line.length - 1; k++) {
    const here = line[k]!;
    const next = line[k + 1]!;
    const published = here.distanceToNextNm;
    const length =
      published !== undefined && published > 0
        ? published
        : greatCircle.distanceNm(here.lat, here.lon, next.lat, next.lon);
    along.push(along[k]! + length);
  }

  let behind: number | undefined;
  for (let k = start; k >= 0; k--) {
    if (k < start && line[k]!.discontinued === true) {
      break;
    }
    if (isVor(line[k]!)) {
      behind = k;
      break;
    }
  }
  let ahead: number | undefined;
  for (let k = start + 1; k < line.length; k++) {
    if (k > start + 1 && line[k - 1]!.discontinued === true) {
      break;
    }
    if (isVor(line[k]!)) {
      ahead = k;
      break;
    }
  }
  if (behind === undefined && ahead === undefined) {
    return undefined;
  }

  let changeover = 0;
  if (behind !== undefined && ahead !== undefined) {
    const published = line[behind]!.changeoverDistanceNm;
    changeover =
      published !== undefined ? along[behind]! + published : (along[behind]! + along[ahead]!) / 2;
  }

  const lengthNm = greatCircle.distanceNm(
    segmentStart.lat,
    segmentStart.lon,
    segmentEnd.lat,
    segmentEnd.lon,
  );
  const bearing = greatCircle.bearing(
    segmentStart.lat,
    segmentStart.lon,
    segmentEnd.lat,
    segmentEnd.lon,
  );
  const steps = Math.max(1, Math.ceil(lengthNm / MOCA_SAMPLE_SPACING_NM));
  const used = new Set<number>();
  let farthestNm = -1;
  let farthestIndex = 0;
  for (let step = 0; step <= steps; step++) {
    const fraction = step / steps;
    const point =
      step === steps
        ? { lat: segmentEnd.lat, lon: segmentEnd.lon }
        : greatCircle.destination(segmentStart.lat, segmentStart.lon, bearing, lengthNm * fraction);
    const alongNm = along[start]! + fraction * (along[start + 1]! - along[start]!);
    const vorIndex =
      ahead === undefined || (behind !== undefined && alongNm <= changeover) ? behind : ahead;
    if (vorIndex === undefined) {
      continue;
    }
    used.add(vorIndex);
    const vor = line[vorIndex]!;
    const distanceNm = greatCircle.distanceNm(point.lat, point.lon, vor.lat, vor.lon);
    if (distanceNm > farthestNm) {
      farthestNm = distanceNm;
      farthestIndex = vorIndex;
    }
  }

  return {
    vors: [...used].sort((a, b) => a - b).map((k) => waypointLabel(line[k]!)),
    farthestNm,
    farthestVor: waypointLabel(line[farthestIndex]!),
  };
}

/**
 * Checks an altitude below a leg's applicable MEA against the segment's
 * MOCA and the allowance the equipment has to use it.
 */
function checkBelowMea(
  leg: RouteAltitudeLeg,
  position: AirwayPosition,
  altitudeFt: number,
  mea: ApplicableMinimumEnrouteAltitude,
  equipment: ReadonlySet<NavigationEquipment>,
): RouteAltitudeFinding {
  const label = mea.basis === 'highRouteGnssDefault' ? 'GNSS high altitude route' : mea.kind;
  const belowMea = `${ft(altitudeFt)} is below the ${label} MEA of ${ft(mea.altitudeFt)}${directionSuffix(mea.direction)}`;
  const moca = leg.minimumObstructionClearanceAltitudeFt;
  if (moca === undefined) {
    return { code: 'belowMea', kind: 'fail', message: `${belowMea}.` };
  }
  if (altitudeFt < moca) {
    return {
      code: 'belowMoca',
      kind: 'fail',
      message: `${belowMea} and the MOCA of ${ft(moca)}.`,
    };
  }
  if (equipment.has('gnss')) {
    leg.belowMeaAllowance = { basis: 'gnss', altitudeFt: moca, cautions: [...BELOW_MEA_CAUTIONS] };
    return {
      code: 'mocaAllowance',
      kind: 'info',
      message: `${belowMea} but at or above the MOCA of ${ft(moca)}, which GNSS-equipped aircraft may use.`,
    };
  }
  if (!equipment.has('conventional')) {
    return {
      code: 'belowMea',
      kind: 'fail',
      message: `${belowMea}; the MOCA of ${ft(moca)} may be used only with GNSS or within ${MOCA_VOR_LIMIT_NM} NM of a VOR.`,
    };
  }
  const coverage = vorCoverage(position);
  if (coverage === undefined) {
    return {
      code: 'mocaBeyondVorRange',
      kind: 'fail',
      message: `${belowMea}; the MOCA of ${ft(moca)} applies only within ${MOCA_VOR_LIMIT_NM} NM of a VOR, and the airway has no VOR to navigate the leg by.`,
    };
  }
  if (coverage.farthestNm <= MOCA_VOR_LIMIT_NM) {
    leg.belowMeaAllowance = {
      basis: 'vorWithin22Nm',
      altitudeFt: moca,
      vors: coverage.vors,
      cautions: [...BELOW_MEA_CAUTIONS],
    };
    return {
      code: 'mocaAllowance',
      kind: 'info',
      message: `${belowMea} but at or above the MOCA of ${ft(moca)}, and the leg stays within ${MOCA_VOR_LIMIT_NM} NM of ${coverage.vors.join(' and ')}.`,
    };
  }
  const farthest = coverage.farthestNm.toFixed(1);
  const beyond = (coverage.farthestNm - MOCA_VOR_LIMIT_NM).toFixed(1);
  return {
    code: 'mocaBeyondVorRange',
    kind: 'fail',
    message: `${belowMea}; the MOCA of ${ft(moca)} applies only within ${MOCA_VOR_LIMIT_NM} NM of the VOR navigated by, and the leg reaches ${farthest} NM from ${coverage.farthestVor}, ${beyond} NM beyond it.`,
  };
}

/** Highest altitude in feet at which every thousand alternates direction (FL410). */
const RVSM_TOP_FT = 41000;

/** Highest altitude in feet considered when naming the nearest cruising altitudes (FL600). */
const CRUISING_ALTITUDE_CEILING_FT = 60000;

/**
 * Whether an altitude is a cruising altitude for a direction of flight under
 * 14 CFR 91.179(b) with RVSM: odd thousands eastbound and even thousands
 * westbound up to FL410, then FL450, 490, 530 and so on eastbound and FL430,
 * 470, 510 and so on westbound.
 */
function isCruisingAltitude(altitudeFt: number, eastbound: boolean): boolean {
  if (altitudeFt <= 0 || altitudeFt % 1000 !== 0) {
    return false;
  }
  if (altitudeFt <= RVSM_TOP_FT) {
    return (altitudeFt / 1000) % 2 === (eastbound ? 1 : 0);
  }
  const base = eastbound ? 45000 : 43000;
  return altitudeFt >= base && (altitudeFt - base) % 4000 === 0;
}

/**
 * Lists the cruising altitudes for a direction of flight nearest an altitude:
 * the highest below it and the lowest above it, where they exist.
 */
function nearestCruisingAltitudes(altitudeFt: number, eastbound: boolean): number[] {
  let below: number | undefined;
  let above: number | undefined;
  for (let candidate = 1000; candidate <= CRUISING_ALTITUDE_CEILING_FT; candidate += 1000) {
    if (!isCruisingAltitude(candidate, eastbound)) {
      continue;
    }
    if (candidate < altitudeFt) {
      below = candidate;
    } else if (candidate > altitudeFt && above === undefined) {
      above = candidate;
    }
  }
  return [below, above].filter((value) => value !== undefined);
}

/**
 * Formats a course in whole degrees, zero-padded to three digits.
 */
function formatCourse(courseDeg: number): string {
  return String(Math.round(courseDeg) % 360).padStart(3, '0');
}

/**
 * Checks a leg's altitude against the cruising altitudes for its direction
 * of flight.
 */
function checkCruisingAltitude(
  from: GeoPoint,
  to: GeoPoint,
  altitude: SourcedAltitude | undefined,
): CruisingAltitudeCheck {
  if (from.procedureLegToNext === true) {
    return {
      status: 'notDeterminable',
      message: 'The leg is part of a SID or STAR, where the aircraft is climbing or descending.',
    };
  }
  if (altitude === undefined) {
    return { status: 'notDeterminable', message: 'No altitude is known for the leg.' };
  }

  const position = from.gapToNext === true ? undefined : from.airwaySegmentToNext;
  const published = position === undefined ? undefined : segmentRecord(position)?.courseDeg;
  const courseSource = published === undefined ? 'computed' : 'published';
  const magneticCourseDeg =
    published ??
    magnetic.trueToMagnetic(
      greatCircle.bearing(from.lat, from.lon, to.lat, to.lon),
      from.lat,
      from.lon,
    );
  const eastbound = ((magneticCourseDeg % 360) + 360) % 360 < 180;
  const direction = eastbound ? 'eastbound' : 'westbound';
  const course = `magnetic course ${formatCourse(magneticCourseDeg)}`;
  const { altitudeFt } = altitude;

  if (isCruisingAltitude(altitudeFt, eastbound)) {
    return {
      status: 'appropriate',
      message: `${ft(altitudeFt)} is a cruising altitude for ${direction} flight (${course}).`,
      magneticCourseDeg,
      courseSource,
      direction,
    };
  }
  const nearest = nearestCruisingAltitudes(altitudeFt, eastbound).map(ft).join(' and ');
  return {
    status: 'inappropriate',
    message: `${ft(altitudeFt)} is not a cruising altitude for ${direction} flight (${course}); the nearest are ${nearest}.`,
    magneticCourseDeg,
    courseSource,
    direction,
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
    cruisingAltitude: checkCruisingAltitude(from, to, altitude),
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
  const moca = segment.record.minimumObstructionClearanceAltitudeFt;
  if (moca !== undefined) {
    leg.minimumObstructionClearanceAltitudeFt = moca;
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
      findings.push(
        checkBelowMea(leg, position, altitude.altitudeFt, leg.minimumEnrouteAltitude, equipment),
      );
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
 * Each leg also carries an advisory `cruisingAltitude` check against the
 * east/west rule of 14 CFR 91.179(b), with RVSM levels from FL290 to FL410,
 * which does not affect any status. The course is the airway segment's
 * published magnetic course in the direction flown, or else the leg's
 * initial great-circle true course converted to magnetic with the World
 * Magnetic Model; SID and STAR legs are not checked.
 *
 * Below the applicable MEA, a leg at or above the segment's MOCA passes with
 * a `belowMeaAllowance` when the equipment includes GNSS, or when it includes
 * conventional navigation and every point of the leg is within 22 NM of the
 * VOR it is navigated by (the nearest VOR along the airway behind and ahead,
 * split at the published changeover point or else midway), under 14 CFR
 * 91.177(a)(2)(ii) and FAA Order JO 7110.65 4-5-6a. Below the MOCA it fails.
 * The 300 ft margin above controlled airspace and clearance below the MEA
 * with radar service are not checked, and neither are procedure altitude
 * constraints.
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
