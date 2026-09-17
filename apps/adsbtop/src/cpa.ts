import { greatCircle } from '@squawk/geo';
import type { Aircraft, Coordinates } from '@squawk/types';

/** Where and when an aircraft's projected path comes nearest the receiver. */
export interface ClosestPointOfApproach {
  /** Distance in nautical miles between the receiver and the aircraft at closest approach. */
  distanceNm: number;
  /** Seconds from now until the aircraft reaches closest approach. Zero when it is passing abeam right now. */
  timeToClosestApproachSec: number;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * How far into the past (in hours) a computed closest approach may fall and
 * still count as "now". An aircraft passing exactly abeam produces a time
 * of zero in exact arithmetic but a value a few femtoseconds either side of
 * it in floating point; without this tolerance the negative side would read
 * as opening and flicker to a placeholder.
 */
const ABEAM_TOLERANCE_HOURS = 1e-9;

/**
 * Projects `aircraft`'s current true track and ground speed as a straight
 * line and finds where that line passes nearest the receiver `location`, for
 * the CPA column and detail row.
 *
 * The aircraft's offset from the receiver comes from a great-circle bearing
 * and distance, so the starting point is exact; the projection itself is on
 * a flat plane, which is accurate to well under a tenth of a mile at the
 * ranges a single ADS-B receiver covers. True track is required rather than
 * magnetic heading - heading ignores wind and variation, and CPA is about
 * movement over the ground.
 *
 * @param location - The configured receiver location (`--lat`/`--lon`).
 * @param aircraft - The aircraft to project.
 * @returns The closest approach, or undefined when the aircraft has no position, no true track, no ground speed above zero, or is already opening (its closest approach is in the past).
 */
export function closestPointOfApproach(
  location: Coordinates,
  aircraft: Aircraft,
): ClosestPointOfApproach | undefined {
  const position = aircraft.position;
  const trackDeg = aircraft.trueTrackDeg;
  const groundSpeedKt = aircraft.groundSpeedKt;
  if (
    position === undefined ||
    trackDeg === undefined ||
    groundSpeedKt === undefined ||
    groundSpeedKt <= 0
  ) {
    return undefined;
  }
  const { bearingDeg, distanceNm } = greatCircle.bearingAndDistance(
    location.lat,
    location.lon,
    position.lat,
    position.lon,
  );
  const bearingRad = degreesToRadians(bearingDeg);
  const eastNm = distanceNm * Math.sin(bearingRad);
  const northNm = distanceNm * Math.cos(bearingRad);
  const trackRad = degreesToRadians(trackDeg);
  const velocityEastKt = groundSpeedKt * Math.sin(trackRad);
  const velocityNorthKt = groundSpeedKt * Math.cos(trackRad);
  const rawTimeToClosestApproachHours =
    -(eastNm * velocityEastKt + northNm * velocityNorthKt) / (groundSpeedKt * groundSpeedKt);
  if (rawTimeToClosestApproachHours < -ABEAM_TOLERANCE_HOURS) {
    return undefined;
  }
  const timeToClosestApproachHours = Math.max(0, rawTimeToClosestApproachHours);
  const closestEastNm = eastNm + velocityEastKt * timeToClosestApproachHours;
  const closestNorthNm = northNm + velocityNorthKt * timeToClosestApproachHours;
  return {
    distanceNm: Math.hypot(closestEastNm, closestNorthNm),
    timeToClosestApproachSec: timeToClosestApproachHours * 3600,
  };
}
