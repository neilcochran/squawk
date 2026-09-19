import type { ScopeTarget } from '../../shared/protocol.js';

/** Vertical rate, in feet per minute, beyond which a target is shown as climbing or descending. */
export const VERTICAL_TREND_THRESHOLD_FT_PER_MIN = 300;

/**
 * Formats an altitude the way a radar data block shows it: hundreds of feet,
 * zero-padded to three digits (`045` for 4,500 ft, `350` for FL350).
 *
 * @param altitudeFt - Altitude in feet MSL.
 * @returns The three-digit (or longer, above 99,900 ft) hundreds string. Negative altitudes clamp to `000`.
 */
export function formatAltitudeHundreds(altitudeFt: number): string {
  return String(Math.max(0, Math.round(altitudeFt / 100))).padStart(3, '0');
}

/**
 * Formats a ground speed the way a radar data block shows it: tens of knots,
 * zero-padded to two digits (`25` for 250 kt).
 *
 * @param groundSpeedKt - Ground speed in knots.
 * @returns The two-digit (or longer, above 990 kt) tens string.
 */
export function formatGroundSpeedTens(groundSpeedKt: number): string {
  return String(Math.max(0, Math.round(groundSpeedKt / 10))).padStart(2, '0');
}

/**
 * Picks the climb/descent marker shown between altitude and ground speed.
 *
 * @param verticalRateFtPerMin - Vertical rate in feet per minute, if known.
 * @returns `^` climbing, `v` descending, or a space when level or unknown.
 */
export function verticalTrendMarker(verticalRateFtPerMin: number | undefined): string {
  if (verticalRateFtPerMin === undefined) {
    return ' ';
  }
  if (verticalRateFtPerMin > VERTICAL_TREND_THRESHOLD_FT_PER_MIN) {
    return '^';
  }
  if (verticalRateFtPerMin < -VERTICAL_TREND_THRESHOLD_FT_PER_MIN) {
    return 'v';
  }
  return ' ';
}

/**
 * Builds the two lines of a target's data block. Line one identifies the
 * aircraft: its callsign, or its ICAO hex until it has sent one. Line two is
 * altitude in hundreds of feet, a climb/descent marker, and ground speed in
 * tens of knots (`045^25`); an aircraft on the ground shows `GND` for
 * altitude, and unknown values show as dashes.
 *
 * @param target - The target to describe.
 * @returns The data block's lines, top first.
 */
export function formatDataBlock(target: ScopeTarget): string[] {
  const identity = target.callsign?.trim();
  let altitude = '---';
  if (target.onGround === true) {
    altitude = 'GND';
  } else if (target.altitudeFt !== undefined) {
    altitude = formatAltitudeHundreds(target.altitudeFt);
  }
  const groundSpeed =
    target.groundSpeedKt !== undefined ? formatGroundSpeedTens(target.groundSpeedKt) : '--';
  return [
    identity !== undefined && identity !== '' ? identity : target.icaoHex.toUpperCase(),
    `${altitude}${verticalTrendMarker(target.verticalRateFtPerMin)}${groundSpeed}`,
  ];
}
