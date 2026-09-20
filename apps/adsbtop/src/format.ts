import type { Aircraft, Position } from '@squawk/types';

import type { MessageLogEntry } from './aircraft-state.js';
import type { ClosestPointOfApproach } from './cpa.js';
import {
  distanceInUnits,
  distanceUnitSuffix,
  formatAltitudeValue,
  formatDistanceValue,
  formatSpeedValue,
  formatVerticalRateValue,
} from './units.js';
import type { UnitSystem } from './units.js';

/**
 * Formats an aircraft's altitude for table display: barometric altitude
 * preferred, geometric (GNSS) altitude as a fallback when barometric is
 * unavailable. Does not special-case on-ground aircraft - see {@link formatOnGround}
 * for that indicator.
 *
 * @param aircraft - The aircraft to read altitude from.
 * @param units - The unit system to render in.
 * @returns The altitude with a unit suffix, or `"-"` if neither field is populated.
 */
export function formatAltitude(aircraft: Aircraft, units: UnitSystem): string {
  return formatAltitudeValue(
    aircraft.position?.baroAltitudeFt ?? aircraft.position?.geoAltitudeFt,
    units,
  );
}

/**
 * Formats a position as `lat, lon` to four decimal places (about 10 m),
 * for the detail view's Position row.
 *
 * @param position - The position, if known.
 * @returns E.g. `"40.6413, -73.7781"`, or `"-"` if undefined.
 */
export function formatPosition(position: Position | undefined): string {
  return position === undefined ? '-' : `${position.lat.toFixed(4)}, ${position.lon.toFixed(4)}`;
}

/**
 * Formats an aircraft's on-ground state for its own table column, separate
 * from altitude. Deliberately blank (not e.g. "AIR") when airborne or
 * unknown, so the column only draws attention when the indicator is true.
 *
 * @param aircraft - The aircraft to read on-ground status from.
 * @returns `"GND"` if `onGround` is true, otherwise `"-"`.
 */
export function formatOnGround(aircraft: Aircraft): string {
  return aircraft.onGround === true ? 'GND' : '-';
}

/**
 * Formats an aircraft's heading for table display: true track preferred,
 * magnetic heading as a fallback when true track is unavailable.
 *
 * @param aircraft - The aircraft to read heading from.
 * @returns The heading in degrees with a trailing degree sign, or `"-"` if neither field is populated.
 */
export function formatHeading(aircraft: Aircraft): string {
  const headingDeg = aircraft.trueTrackDeg ?? aircraft.magneticHeadingDeg;
  return headingDeg === undefined ? '-' : `${Math.round(headingDeg)}°`;
}

/**
 * Formats an aircraft's ground speed for table display.
 *
 * @param aircraft - The aircraft to read ground speed from.
 * @param units - The unit system to render in.
 * @returns The ground speed with a unit suffix, or `"-"` if unavailable.
 */
export function formatGroundSpeed(aircraft: Aircraft, units: UnitSystem): string {
  return formatSpeedValue(aircraft.groundSpeedKt, units);
}

/**
 * Formats a great-circle distance for table display.
 *
 * @param distanceNm - Distance in nautical miles, or undefined if not computable.
 * @param units - The unit system to render in.
 * @returns The distance with a unit suffix, or `"-"` if undefined.
 */
export function formatDistance(distanceNm: number | undefined, units: UnitSystem): string {
  return formatDistanceValue(distanceNm, units);
}

/**
 * Formats a great-circle bearing for table display, matching {@link formatHeading}'s style.
 *
 * @param bearingDeg - Bearing in degrees true, or undefined if not computable.
 * @returns The bearing in degrees with a trailing degree sign, or `"-"` if undefined.
 */
export function formatBearing(bearingDeg: number | undefined): string {
  return bearingDeg === undefined ? '-' : `${Math.round(bearingDeg)}°`;
}

/**
 * Formats an aircraft's vertical rate for table display, with an explicit
 * `+` sign on climbs so climb/descend is visible without color.
 *
 * @param aircraft - The aircraft to read vertical rate from.
 * @param units - The unit system to render in.
 * @returns The vertical rate with a unit suffix, or `"-"` if unavailable.
 */
export function formatVerticalRate(aircraft: Aircraft, units: UnitSystem): string {
  return formatVerticalRateValue(aircraft.verticalRateFtPerMin, units);
}

/**
 * Formats a duration in whole seconds, escalating precision as the value
 * grows: seconds, then minutes/seconds, then hours/minutes.
 *
 * @param totalSec - The duration in whole, non-negative seconds.
 * @returns A short duration string, e.g. `"3s"`, `"1m05s"`, or `"2h03m"`.
 */
export function formatDuration(totalSec: number): string {
  if (totalSec < 60) {
    return `${totalSec}s`;
  }
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes < 60) {
    return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h${remainingMinutes.toString().padStart(2, '0')}m`;
}

/**
 * Formats the time elapsed since `lastSeenAt` for the table's age column,
 * in {@link formatDuration}'s style.
 *
 * @param lastSeenAt - Unix epoch ms the aircraft was last updated.
 * @param nowMs - Unix epoch ms to measure elapsed time against, supplied by the caller so this stays pure and testable.
 * @returns A short elapsed-time string, e.g. `"3s"`, `"1m05s"`, or `"2h03m"`.
 */
export function formatAge(lastSeenAt: number, nowMs: number): string {
  return formatDuration(Math.max(0, Math.floor((nowMs - lastSeenAt) / 1000)));
}

/**
 * Formats a closest point of approach for the CPA column and detail row:
 * the distance at closest approach and how long until the aircraft gets
 * there. Distance keeps one decimal under 10 (nm or km), where tenths
 * matter for judging whether something will pass overhead, and rounds to
 * whole units beyond that.
 *
 * @param cpa - The projected closest approach, or undefined if not computable.
 * @param units - The unit system to render in.
 * @returns A string like `"2.1nm in 4m10s"` or `"3.9km in 4m10s"`, or `"-"` if undefined.
 */
export function formatClosestApproach(
  cpa: ClosestPointOfApproach | undefined,
  units: UnitSystem,
): string {
  if (cpa === undefined) {
    return '-';
  }
  const value = distanceInUnits(cpa.distanceNm, units);
  const tenths = Math.round(value * 10) / 10;
  const distance = tenths < 10 ? tenths.toFixed(1) : String(Math.round(value));
  const duration = formatDuration(Math.round(cpa.timeToClosestApproachSec));
  return `${distance}${distanceUnitSuffix(units)} in ${duration}`;
}

/** Fixed-width label per {@link MessageLogEntry.type}, for column alignment in the messages panel. */
const MESSAGE_LOG_LABELS: Record<MessageLogEntry['type'], string> = {
  new: 'NEW ',
  update: 'UPDT',
  lost: 'LOST',
};

/**
 * Formats one {@link MessageLogEntry} for the `[M]essages` panel.
 *
 * The clock is rendered in UTC (`HH:MM:SS`) rather than local time so log
 * output is deterministic in tests regardless of the runner's timezone -
 * for a live-scrolling log the UTC/local distinction isn't meaningful to a
 * user watching it update in real time.
 *
 * @param entry - The log entry to format.
 * @returns A single display line, e.g. `"14:23:05  NEW   A0B1C2  UAL123"`.
 */
export function formatMessageLogLine(entry: MessageLogEntry): string {
  const time = new Date(entry.at).toISOString().slice(11, 19);
  const label = MESSAGE_LOG_LABELS[entry.type];
  const callsign = entry.callsign ?? '-';
  return `${time}  ${label}  ${entry.icaoHex}  ${callsign}`;
}
