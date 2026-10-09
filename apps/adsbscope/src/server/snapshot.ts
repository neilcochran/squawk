import { isEmergencySquawk } from '@squawk/adsb-feed';
import type { AircraftFeed, PositionHistoryEntry } from '@squawk/adsb-feed';
import { greatCircle } from '@squawk/geo';
import type { Aircraft, Coordinates, TargetStateAndStatus } from '@squawk/types';

import type {
  PolarPoint,
  ScopeAutopilot,
  ScopeAutopilotMode,
  ScopeSnapshot,
  ScopeTarget,
} from '../shared/protocol.js';

import type { AircraftModelLookup } from './aircraft-model.js';
import { classifyEmergency } from './emergency.js';

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
 * Reduces an aircraft's Target State and Status to what the scope shows of
 * its autopilot: whether it is engaged, and which modes are. Undefined when
 * the aircraft reports no mode status, in which case every mode flag is
 * undefined together.
 */
function toScopeAutopilot(
  targetState: TargetStateAndStatus | undefined,
): ScopeAutopilot | undefined {
  if (targetState?.autopilotEngaged === undefined) {
    return undefined;
  }
  const modes: ScopeAutopilotMode[] = [];
  if (targetState.vnavModeActive === true) {
    modes.push('vnav');
  }
  if (targetState.altitudeHoldModeActive === true) {
    modes.push('altitudeHold');
  }
  if (targetState.approachModeActive === true) {
    modes.push('approach');
  }
  if (targetState.lnavModeActive === true) {
    modes.push('lnav');
  }
  return { engaged: targetState.autopilotEngaged, modes };
}

/**
 * Converts one tracked aircraft into the form the scope draws. Numeric fields
 * are rounded to what a data block can show (whole feet, knots, and feet per
 * minute; tenths of a degree of track and heading), since a source that
 * derives them - Beast ground speed comes from a decoded velocity vector -
 * reports them at full double precision.
 *
 * The transponder's flags are carried only while they are set. The squawk
 * alert is dropped for an emergency squawk: the transponder holds it for as
 * long as the code is set, and the scope already marks the emergency itself.
 *
 * @param aircraft - The aircraft's current normalized state.
 * @param history - The aircraft's retained position history, oldest first.
 * @param receiver - The receiving station's position.
 * @param now - Unix epoch ms the snapshot is being taken.
 * @param aircraftModel - The model the aircraft is registered as, if known.
 * @returns The scope target.
 */
export function toScopeTarget(
  aircraft: Aircraft,
  history: readonly PositionHistoryEntry[],
  receiver: Coordinates,
  now: number,
  aircraftModel: string | undefined,
): ScopeTarget {
  const altitudeFt = aircraft.position?.baroAltitudeFt ?? aircraft.position?.geoAltitudeFt;
  const emergency = classifyEmergency(aircraft);
  const squawkAlert =
    aircraft.squawkAlert === true &&
    (aircraft.squawk === undefined || !isEmergencySquawk(aircraft.squawk));
  const selectedAltitudeFt = aircraft.targetState?.selectedAltitudeFt;
  const selectedHeadingDeg = aircraft.targetState?.selectedHeadingDeg;
  const autopilot = toScopeAutopilot(aircraft.targetState);
  return {
    icaoHex: aircraft.icaoHex,
    ...(aircraft.callsign !== undefined && { callsign: aircraft.callsign }),
    ...(aircraft.squawk !== undefined && { squawk: aircraft.squawk }),
    ...(squawkAlert && { squawkAlert: true }),
    ...(aircraft.identActive === true && { identActive: true }),
    ...(emergency !== undefined && { emergency }),
    ...(aircraftModel !== undefined && { aircraftModel }),
    ...(aircraft.category !== undefined && { category: aircraft.category }),
    ...(altitudeFt !== undefined && { altitudeFt: roundTo(altitudeFt, 0) }),
    ...(aircraft.groundSpeedKt !== undefined && {
      groundSpeedKt: roundTo(aircraft.groundSpeedKt, 0),
    }),
    ...(aircraft.indicatedAirspeedKt !== undefined && {
      indicatedAirspeedKt: roundTo(aircraft.indicatedAirspeedKt, 0),
    }),
    ...(aircraft.trueAirspeedKt !== undefined && {
      trueAirspeedKt: roundTo(aircraft.trueAirspeedKt, 0),
    }),
    ...(aircraft.trueTrackDeg !== undefined && { trueTrackDeg: roundTo(aircraft.trueTrackDeg, 1) }),
    ...(aircraft.magneticHeadingDeg !== undefined && {
      magneticHeadingDeg: roundTo(aircraft.magneticHeadingDeg, 1),
    }),
    ...(aircraft.verticalRateFtPerMin !== undefined && {
      verticalRateFtPerMin: roundTo(aircraft.verticalRateFtPerMin, 0),
    }),
    ...(aircraft.onGround !== undefined && { onGround: aircraft.onGround }),
    ...(selectedAltitudeFt !== undefined && { selectedAltitudeFt: roundTo(selectedAltitudeFt, 0) }),
    ...(selectedHeadingDeg !== undefined && {
      selectedHeadingDeg: roundTo(selectedHeadingDeg, 1),
    }),
    ...(autopilot !== undefined && { autopilot }),
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
 * @param lookupModel - Looks up the model an aircraft is registered as.
 * @returns The snapshot, with targets ordered by ICAO hex so consecutive snapshots are stable.
 */
export function buildSnapshot(
  feed: AircraftFeed,
  receiver: Coordinates,
  now: number,
  lookupModel: AircraftModelLookup,
): ScopeSnapshot {
  const targets = feed
    .getAllAircraft()
    .map((aircraft) =>
      toScopeTarget(
        aircraft,
        feed.getPositionHistory(aircraft.icaoHex),
        receiver,
        now,
        lookupModel(aircraft.icaoHex),
      ),
    )
    .sort((a, b) => a.icaoHex.localeCompare(b.icaoHex));
  return { at: now, connection: feed.getConnectionState(), targets };
}
