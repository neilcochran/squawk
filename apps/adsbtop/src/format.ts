import type { Aircraft, EmergencyState, Position } from '@squawk/types';

import type { MessageLogEntry } from './aircraft-state.js';
import type { ClosestPointOfApproach } from './cpa.js';

/** Squawk codes that always indicate a declared emergency, regardless of source. */
const EMERGENCY_SQUAWKS: ReadonlySet<string> = new Set(['7500', '7600', '7700']);

/**
 * Whether `squawk` is one of the three universally-reserved emergency codes
 * (hijack/radio failure/general emergency). Works identically across all
 * three feed sources, since `squawk` is populated uniformly by JSON, SBS,
 * and Beast.
 *
 * @param squawk - The aircraft's current squawk code, if known.
 * @returns True if `squawk` is 7500, 7600, or 7700.
 */
export function isEmergencySquawk(squawk: string | undefined): boolean {
  return squawk !== undefined && EMERGENCY_SQUAWKS.has(squawk);
}

// 'none' and 'reserved' are not declared emergencies - only the remaining EmergencyState values are.
function isDeclaredEmergencyState(emergencyState: EmergencyState | undefined): boolean {
  return emergencyState !== undefined && emergencyState !== 'none' && emergencyState !== 'reserved';
}

/**
 * Whether `aircraft` should render as an emergency row: a declared emergency
 * squawk code, a declared emergency state, or a currently-active ACAS/TCAS
 * Resolution Advisory. Any one of the three is sufficient - they arrive on
 * different messages (and different sources - see the `@squawk/adsb-feed`
 * README's "Field population by source" section) and aren't expected to
 * always agree.
 *
 * @param aircraft - The aircraft to check.
 * @returns True if any of the three emergency signals is present.
 */
export function isEmergencyAircraft(aircraft: Aircraft): boolean {
  return (
    isEmergencySquawk(aircraft.squawk) ||
    isDeclaredEmergencyState(aircraft.emergencyState) ||
    aircraft.resolutionAdvisory?.active === true
  );
}

/**
 * Formats an aircraft's altitude for table display: barometric altitude
 * preferred, geometric (GNSS) altitude as a fallback when barometric is
 * unavailable. Does not special-case on-ground aircraft - see {@link formatOnGround}
 * for that indicator.
 *
 * @param aircraft - The aircraft to read altitude from.
 * @returns The altitude in feet with a unit suffix, or `"-"` if neither field is populated.
 */
export function formatAltitude(aircraft: Aircraft): string {
  const altitudeFt = aircraft.position?.baroAltitudeFt ?? aircraft.position?.geoAltitudeFt;
  return altitudeFt === undefined ? '-' : `${Math.round(altitudeFt)}ft`;
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
 * @returns The ground speed in knots with a unit suffix, or `"-"` if unavailable.
 */
export function formatGroundSpeed(aircraft: Aircraft): string {
  return aircraft.groundSpeedKt === undefined ? '-' : `${Math.round(aircraft.groundSpeedKt)}kt`;
}

/**
 * Formats a great-circle distance for table display.
 *
 * @param distanceNm - Distance in nautical miles, or undefined if not computable.
 * @returns The distance in nautical miles with a unit suffix, or `"-"` if undefined.
 */
export function formatDistance(distanceNm: number | undefined): string {
  return distanceNm === undefined ? '-' : `${Math.round(distanceNm)}nm`;
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
 * @returns The vertical rate in feet per minute with a unit suffix, or `"-"` if unavailable.
 */
export function formatVerticalRate(aircraft: Aircraft): string {
  const rate = aircraft.verticalRateFtPerMin;
  if (rate === undefined) {
    return '-';
  }
  const rounded = Math.round(rate);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}fpm`;
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
 * there. Distance keeps one decimal under 10 nm, where tenths matter for
 * judging whether something will pass overhead, and rounds to whole miles
 * beyond that.
 *
 * @param cpa - The projected closest approach, or undefined if not computable.
 * @returns A string like `"2.1nm in 4m10s"`, or `"-"` if undefined.
 */
export function formatClosestApproach(cpa: ClosestPointOfApproach | undefined): string {
  if (cpa === undefined) {
    return '-';
  }
  const tenthsNm = Math.round(cpa.distanceNm * 10) / 10;
  const distance = tenthsNm < 10 ? tenthsNm.toFixed(1) : String(Math.round(cpa.distanceNm));
  return `${distance}nm in ${formatDuration(Math.round(cpa.timeToClosestApproachSec))}`;
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
