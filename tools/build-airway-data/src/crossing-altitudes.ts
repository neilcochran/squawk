import type { AirwayWaypoint } from '@squawk/types';

import type { AirwayPointRecord, AirwaySegmentRecord } from './build-waypoint.js';

/**
 * Outcome of placing an airway's minimum crossing altitudes.
 */
export interface CrossingAltitudePlacement {
  /** Number of MCAs attached to their named waypoint. */
  attached: number;
  /** One message per MCA that could not be placed, naming the record and the reason. */
  unplaced: string[];
}

/**
 * Attaches each segment record's minimum crossing altitude to the waypoint
 * the FAA names for it.
 *
 * NASR publishes an MCA on the first segment record of the Part 95 segment it
 * belongs to, together with the point it applies at (`J70  *AUGER*WI`). That
 * point is the record's own waypoint in a few cases and the next one most of
 * the time, but it can be up to eight points further along the airway, so the
 * MCA fields are copied to the named waypoint rather than the record's. An
 * MCA whose point is blank, names a point that is not on the airway, names a
 * point without coordinates, or names a waypoint that already carries an MCA
 * is left off and reported.
 *
 * @param label - Airway designation used in the messages.
 * @param segments - The airway's segment records in sequence order.
 * @param points - The matching point records, undefined where a sequence number has none.
 * @param waypoints - The waypoints built from those records, undefined where a point could not be placed; mutated in place.
 * @returns The number of MCAs attached and the messages for those left off.
 */
export function attachCrossingAltitudes(
  label: string,
  segments: readonly AirwaySegmentRecord[],
  points: readonly (AirwayPointRecord | undefined)[],
  waypoints: readonly (AirwayWaypoint | undefined)[],
): CrossingAltitudePlacement {
  let attached = 0;
  const unplaced: string[] = [];

  for (const segment of segments) {
    if (segment.minimumCrossingAltitudeFt === undefined) {
      continue;
    }
    const where = `${label} seq ${segment.sequenceNumber}`;
    const pointName = segment.minimumCrossingAltitudePoint;
    if (pointName === undefined) {
      unplaced.push(`${where}: MCA ${segment.minimumCrossingAltitudeFt} without a named point`);
      continue;
    }
    const target = points.findIndex(
      (point) =>
        point !== undefined && (point.name === pointName || point.navaidIdentifier === pointName),
    );
    if (target === -1) {
      unplaced.push(`${where}: MCA point ${pointName} is not a point of the airway`);
      continue;
    }
    const waypoint = waypoints[target];
    if (waypoint === undefined) {
      unplaced.push(`${where}: MCA point ${pointName} has no coordinates`);
      continue;
    }
    if (waypoint.minimumCrossingAltitudeFt !== undefined) {
      unplaced.push(`${where}: MCA point ${pointName} already carries an MCA`);
      continue;
    }

    waypoint.minimumCrossingAltitudeFt = segment.minimumCrossingAltitudeFt;
    if (segment.minimumCrossingAltitudeDirection !== undefined) {
      waypoint.minimumCrossingAltitudeDirection = segment.minimumCrossingAltitudeDirection;
    }
    if (segment.minimumCrossingAltitudeOppositeFt !== undefined) {
      waypoint.minimumCrossingAltitudeOppositeFt = segment.minimumCrossingAltitudeOppositeFt;
      if (segment.minimumCrossingAltitudeOppositeDirection !== undefined) {
        waypoint.minimumCrossingAltitudeOppositeDirection =
          segment.minimumCrossingAltitudeOppositeDirection;
      }
    }
    attached += 1;
  }

  return { attached, unplaced };
}
