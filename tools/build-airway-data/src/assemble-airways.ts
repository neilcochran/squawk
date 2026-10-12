import type { Airway, AirwayRegion, AirwayType, AirwayWaypoint } from '@squawk/types';
import { AIRWAY_REGION_MAP } from '@squawk/types';

import type { AirwayPointRecord, AirwaySegmentRecord } from './build-waypoint.js';
import { buildWaypoint } from './build-waypoint.js';
import type { CrossingAltitudePlacement } from './crossing-altitudes.js';
import { attachCrossingAltitudes } from './crossing-altitudes.js';

/**
 * Every record NASR publishes for one airway, keyed by point sequence number
 * where the record type has one.
 */
export interface AirwaySourceRecords<
  S extends AirwaySegmentRecord = AirwaySegmentRecord,
  P extends AirwayPointRecord = AirwayPointRecord,
> {
  /** Bundled designation (`V16`, `ATA315`). */
  designation: string;
  /** Airway type character (blank, A, or H). */
  airwayTypeChar: string;
  /** Segment records (AWY1 / ATS1) by sequence number. */
  segments: Map<number, S>;
  /** Point records (AWY2 / ATS2) by sequence number. */
  points: Map<number, P>;
  /** Point remark lines (AWY4 / ATS4) by sequence number, in file order. */
  pointRemarks: Map<number, string[]>;
  /** Route remark lines (RMK) in file order. */
  remarks: string[];
}

/**
 * Result of assembling one airway from its source records.
 */
export interface AssembledAirway {
  /** The airway, or undefined when none of its points could be placed. */
  airway: Airway | undefined;
  /** How the airway's minimum crossing altitudes were placed. */
  crossingAltitudes: CrossingAltitudePlacement;
  /** Number of waypoints flagged unusable. */
  unusableSegments: number;
}

/**
 * Determines the AirwayRegion from the airway type character.
 */
export function regionOf(airwayTypeChar: string): AirwayRegion {
  return AIRWAY_REGION_MAP[airwayTypeChar] ?? 'US';
}

/**
 * Keeps the waypoints of one airway that could be built, in sequence order.
 *
 * A waypoint's `distanceToNextNm` is the FAA's distance to the point that
 * follows it in the source sequence. When that point was not built (a border
 * crossing without coordinates, say), or when nothing follows at all, the
 * published value no longer describes a leg to the next waypoint in the
 * output, so it is cleared.
 *
 * @param sequence - Build results in sequence order, `undefined` where a point could not be built.
 * @returns The built waypoints, with `distanceToNextNm` only where it runs to the next one.
 */
export function assembleWaypoints(
  sequence: readonly (AirwayWaypoint | undefined)[],
): AirwayWaypoint[] {
  const waypoints: AirwayWaypoint[] = [];
  for (let i = 0; i < sequence.length; i++) {
    const wp = sequence[i];
    if (wp === undefined) {
      continue;
    }
    if (sequence[i + 1] === undefined) {
      delete wp.distanceToNextNm;
    }
    waypoints.push(wp);
  }
  return waypoints;
}

/**
 * Assembles one airway: builds a waypoint for every segment record that has a
 * point record, attaches the minimum crossing altitudes to their named
 * waypoints, drops the points that could not be placed, and carries the
 * route remarks.
 *
 * @param type - The airway's type, already resolved from its designation.
 * @param source - The airway's records.
 * @returns The airway with placement and unusable-segment counts.
 */
export function assembleAirway(type: AirwayType, source: AirwaySourceRecords): AssembledAirway {
  const sequenceNumbers = [...source.segments.keys()].sort((a, b) => a - b);
  const segments: AirwaySegmentRecord[] = [];
  const points: (AirwayPointRecord | undefined)[] = [];
  const built: (AirwayWaypoint | undefined)[] = [];
  for (const sequenceNumber of sequenceNumbers) {
    const segment = source.segments.get(sequenceNumber);
    if (segment === undefined) {
      continue;
    }
    const point = source.points.get(sequenceNumber);
    segments.push(segment);
    points.push(point);
    built.push(
      point === undefined
        ? undefined
        : buildWaypoint(segment, point, source.pointRemarks.get(sequenceNumber) ?? []),
    );
  }

  const crossingAltitudes = attachCrossingAltitudes(source.designation, segments, points, built);
  const waypoints = assembleWaypoints(built);
  const unusableSegments = waypoints.filter((wp) => wp.unusable === true).length;

  if (waypoints.length === 0) {
    return { airway: undefined, crossingAltitudes, unusableSegments };
  }

  const airway: Airway = {
    designation: source.designation,
    type,
    region: regionOf(source.airwayTypeChar),
    waypoints,
  };
  if (source.remarks.length > 0) {
    airway.remarks = [...source.remarks];
  }
  return { airway, crossingAltitudes, unusableSegments };
}
