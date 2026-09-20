import type { ScopeTarget } from '../../shared/protocol.js';

import { EMERGENCY_CODES } from './emergency.js';

/**
 * The most characters of an aircraft's model a data block shows. Registered
 * models run to 20 characters, which would make a block two and a half times
 * the width of a callsign; 12 shows more than nine in ten of them whole, and
 * what it cuts still reads (`ERJ 170-200`, `FALCON 2000`). Only the blocks
 * that need the width take it: a block is as wide as its own text.
 */
export const DATA_BLOCK_MODEL_MAX_CHARS = 12;

/** How long one turn of the data block time-share lasts: the usual second line, then the alternate one. */
export const TIME_SHARE_CYCLE_MS = 4000;

/** How much of the end of each time-share cycle shows the alternate second line. */
export const TIME_SHARE_ALTERNATE_MS = 1500;

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

/** The two lines of a data block: who the aircraft is, then its altitude and ground speed. */
export type DataBlockLines = [identity: string, detail: string];

function formatIdentity(target: ScopeTarget): string {
  const callsign = target.callsign?.trim();
  const identity =
    callsign !== undefined && callsign !== '' ? callsign : target.icaoHex.toUpperCase();
  return target.emergency === undefined
    ? identity
    : `${identity} ${EMERGENCY_CODES[target.emergency]}`;
}

/**
 * Builds the two lines of a target's data block. Line one identifies the
 * aircraft: its callsign, or its ICAO hex until it has sent one, followed by
 * its emergency code (`UAL123 EM`) if it is in an emergency. Line two is
 * altitude in hundreds of feet, a climb/descent marker, and ground speed in
 * tens of knots (`045^25`); an aircraft on the ground shows `GND` for
 * altitude, and unknown values show as dashes.
 *
 * @param target - The target to describe.
 * @returns The data block's lines, top first.
 */
export function formatDataBlock(target: ScopeTarget): DataBlockLines {
  let altitude = '---';
  if (target.onGround === true) {
    altitude = 'GND';
  } else if (target.altitudeFt !== undefined) {
    altitude = formatAltitudeHundreds(target.altitudeFt);
  }
  const groundSpeed =
    target.groundSpeedKt !== undefined ? formatGroundSpeedTens(target.groundSpeedKt) : '--';
  return [
    formatIdentity(target),
    `${altitude}${verticalTrendMarker(target.verticalRateFtPerMin)}${groundSpeed}`,
  ];
}

/**
 * Builds the lines a target's data block shows during the alternate part of
 * the time-share: the same first line, over the model the aircraft is
 * registered as, cut to {@link DATA_BLOCK_MODEL_MAX_CHARS}. A real scope
 * time-shares the ICAO type designator here (`B738`); the FAA registry has
 * no designators, so the registered model (`737-8H4`) stands in.
 *
 * @param target - The target to describe.
 * @returns The alternate lines, or undefined if the aircraft's model is not known - its block then never changes.
 */
export function formatAlternateDataBlock(target: ScopeTarget): DataBlockLines | undefined {
  if (target.aircraftModel === undefined) {
    return undefined;
  }
  return [
    formatIdentity(target),
    target.aircraftModel.slice(0, DATA_BLOCK_MODEL_MAX_CHARS).trimEnd(),
  ];
}

/**
 * Decides which second line every data block shows at an instant. Blocks
 * time-share in unison, as on a real scope: the usual line for most of each
 * {@link TIME_SHARE_CYCLE_MS}, the alternate for its last
 * {@link TIME_SHARE_ALTERNATE_MS}.
 *
 * @param frameTimeMs - The animation clock, in milliseconds.
 * @returns True while the alternate line is showing.
 */
export function isTimeShareAlternate(frameTimeMs: number): boolean {
  return frameTimeMs % TIME_SHARE_CYCLE_MS >= TIME_SHARE_CYCLE_MS - TIME_SHARE_ALTERNATE_MS;
}
