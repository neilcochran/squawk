import type { AircraftFeed, PositionHistoryEntry } from '@squawk/adsb-feed';
import { greatCircle } from '@squawk/geo';
import type { Aircraft, Coordinates } from '@squawk/types';

import type { PolarPoint, ScopeSnapshot, ScopeTarget } from '../shared/protocol.js';

/** Minimum time between two points of a target's history trail. */
export const HISTORY_SPACING_MS = 5000;

/** Maximum number of points in a target's history trail. */
export const HISTORY_POINT_COUNT = 5;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Resolves a geographic position into the scope's receiver-relative polar
 * coordinates, rounded to a hundredth of a degree and a thousandth of a
 * nautical mile (about two meters) - far finer than a pixel at any scope
 * range, and much shorter on the wire than full double precision.
 *
 * @param receiver - The receiving station's position: the center of the scope.
 * @param position - The position to resolve.
 * @returns Bearing and range from the receiver.
 */
export function toPolarPoint(receiver: Coordinates, position: Coordinates): PolarPoint {
  const { bearingDeg, distanceNm } = greatCircle.bearingAndDistance(
    receiver.lat,
    receiver.lon,
    position.lat,
    position.lon,
  );
  return { trueBearingDeg: roundTo(bearingDeg, 2), rangeNm: roundTo(distanceNm, 3) };
}

/**
 * Thins an aircraft's position history into the few evenly spaced points the
 * scope draws as a trail. Walks back from the newest entry, keeping one
 * point per {@link HISTORY_SPACING_MS}, and skips anything newer than one
 * spacing interval so the trail does not pile up under the current position.
 *
 * @param entries - The aircraft's retained position history, oldest first.
 * @param now - Unix epoch ms the snapshot is being taken.
 * @returns At most {@link HISTORY_POINT_COUNT} entries, oldest first.
 */
export function sampleHistory(
  entries: readonly PositionHistoryEntry[],
  now: number,
): PositionHistoryEntry[] {
  const sampled: PositionHistoryEntry[] = [];
  let nextAt = now - HISTORY_SPACING_MS;
  for (let i = entries.length - 1; i >= 0 && sampled.length < HISTORY_POINT_COUNT; i--) {
    const entry = entries[i];
    if (entry === undefined || entry.recordedAt > nextAt) {
      continue;
    }
    sampled.push(entry);
    nextAt = entry.recordedAt - HISTORY_SPACING_MS;
  }
  return sampled.reverse();
}

/**
 * Converts one tracked aircraft into the form the scope draws. Numeric fields
 * are rounded to what a data block can show (whole feet, knots, and feet per
 * minute; tenths of a degree of track), since a source that derives them -
 * Beast ground speed comes from a decoded velocity vector - reports them at
 * full double precision.
 *
 * @param aircraft - The aircraft's current normalized state.
 * @param history - The aircraft's retained position history, oldest first.
 * @param receiver - The receiving station's position.
 * @param now - Unix epoch ms the snapshot is being taken.
 * @returns The scope target.
 */
export function toScopeTarget(
  aircraft: Aircraft,
  history: readonly PositionHistoryEntry[],
  receiver: Coordinates,
  now: number,
): ScopeTarget {
  const altitudeFt = aircraft.position?.baroAltitudeFt ?? aircraft.position?.geoAltitudeFt;
  return {
    icaoHex: aircraft.icaoHex,
    ...(aircraft.callsign !== undefined && { callsign: aircraft.callsign }),
    ...(aircraft.squawk !== undefined && { squawk: aircraft.squawk }),
    ...(altitudeFt !== undefined && { altitudeFt: roundTo(altitudeFt, 0) }),
    ...(aircraft.groundSpeedKt !== undefined && {
      groundSpeedKt: roundTo(aircraft.groundSpeedKt, 0),
    }),
    ...(aircraft.trueTrackDeg !== undefined && { trueTrackDeg: roundTo(aircraft.trueTrackDeg, 1) }),
    ...(aircraft.verticalRateFtPerMin !== undefined && {
      verticalRateFtPerMin: roundTo(aircraft.verticalRateFtPerMin, 0),
    }),
    ...(aircraft.onGround !== undefined && { onGround: aircraft.onGround }),
    ...(aircraft.position !== undefined && {
      position: toPolarPoint(receiver, aircraft.position),
    }),
    history: sampleHistory(history, now).map((entry) => toPolarPoint(receiver, entry.position)),
    lastSeenAt: aircraft.lastSeenAt,
  };
}

/**
 * Takes a snapshot of everything the feed is currently tracking.
 *
 * @param feed - The feed to read.
 * @param receiver - The receiving station's position.
 * @param now - Unix epoch ms the snapshot is being taken.
 * @returns The snapshot, with targets ordered by ICAO hex so consecutive snapshots are stable.
 */
export function buildSnapshot(
  feed: AircraftFeed,
  receiver: Coordinates,
  now: number,
): ScopeSnapshot {
  const targets = feed
    .getAllAircraft()
    .map((aircraft) =>
      toScopeTarget(aircraft, feed.getPositionHistory(aircraft.icaoHex), receiver, now),
    )
    .sort((a, b) => a.icaoHex.localeCompare(b.icaoHex));
  return { at: now, connection: feed.getConnectionState(), targets };
}
