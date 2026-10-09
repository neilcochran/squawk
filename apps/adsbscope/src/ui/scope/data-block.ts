import type { ScopeTarget } from '../../shared/protocol.js';

import { categoryCode, isHeavyCategory } from './category.js';
import { EMERGENCY_CODES } from './emergency.js';

/**
 * The most characters of an aircraft's model a data block shows. Registered
 * models run to 20 characters, which would make a block two and a half times
 * the width of a callsign; 12 shows more than nine in ten of them whole, and
 * what it cuts still reads (`ERJ 170-200`, `FALCON 2000`). Only the blocks
 * that need the width take it: a block is as wide as its own text.
 */
export const DATA_BLOCK_MODEL_MAX_CHARS = 12;

/** Prefix of a heavy's type in the data block, as on a flight strip (`H/777-222`). */
export const HEAVY_TYPE_PREFIX = 'H/';

/** The code shown after the identity while the transponder's Ident is active. */
export const IDENT_CODE = 'ID';

/**
 * How far, in feet, the selected altitude must be from the current one for a
 * data block to show it. An aircraft flying level has selected the altitude
 * it is at, and its block has nothing to add.
 */
export const SELECTED_ALTITUDE_MIN_DIFFERENCE_FT = 300;

/** How long each turn of the data block time-share shows the usual second line: altitude and ground speed. */
export const TIME_SHARE_USUAL_MS = 2500;

/** How long each turn of the time-share shows the type line, when a block has one. */
export const TIME_SHARE_TYPE_MS = 1500;

/** How long each turn of the time-share shows the clearance line, when a block has one. */
export const TIME_SHARE_CLEARANCE_MS = 1500;

/** How long one turn of the data block time-share lasts: the usual second line, then the type, then the clearance. */
export const TIME_SHARE_CYCLE_MS =
  TIME_SHARE_USUAL_MS + TIME_SHARE_TYPE_MS + TIME_SHARE_CLEARANCE_MS;

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
  if (target.emergency !== undefined) {
    return `${identity} ${EMERGENCY_CODES[target.emergency]}`;
  }
  if (target.identActive === true) {
    return `${identity} ${IDENT_CODE}`;
  }
  return identity;
}

/**
 * Builds the two lines of a target's data block. Line one identifies the
 * aircraft: its callsign, or its ICAO hex until it has sent one, followed by
 * its emergency code (`UAL123 EM`) if it is in an emergency, or otherwise by
 * `ID` while the pilot is squawking ident. An emergency takes the slot: the
 * ident still shows on the position symbol. Line two is altitude in hundreds
 * of feet, a climb/descent marker, and ground speed in tens of knots
 * (`045^25`); an aircraft on the ground shows `GND` for altitude, and
 * unknown values show as dashes.
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

function formatType(target: ScopeTarget): string | undefined {
  if (target.aircraftModel === undefined) {
    return categoryCode(target.category);
  }
  const model = target.aircraftModel.slice(0, DATA_BLOCK_MODEL_MAX_CHARS).trimEnd();
  return isHeavyCategory(target.category) ? `${HEAVY_TYPE_PREFIX}${model}` : model;
}

/**
 * Builds the lines a target's data block shows during the type part of the
 * time-share: the same first line, over the model the aircraft is registered
 * as, cut to {@link DATA_BLOCK_MODEL_MAX_CHARS} and prefixed `H/` for a
 * heavy, as a flight strip writes the type. A real scope time-shares the
 * ICAO type designator here (`B738`); the FAA registry has no designators,
 * so the registered model (`737-8H4`) stands in. When the model is not known
 * but the aircraft broadcasts a category, its three-letter code (`HVY`,
 * `LRG`) stands in for that.
 *
 * @param target - The target to describe.
 * @returns The type lines, or undefined if neither the model nor the category is known.
 */
export function formatTypeDataBlock(target: ScopeTarget): DataBlockLines | undefined {
  const type = formatType(target);
  return type === undefined ? undefined : [formatIdentity(target), type];
}

function formatClearance(target: ScopeTarget): string | undefined {
  if (
    target.onGround === true ||
    target.altitudeFt === undefined ||
    target.selectedAltitudeFt === undefined
  ) {
    return undefined;
  }
  const differenceFt = target.selectedAltitudeFt - target.altitudeFt;
  if (Math.abs(differenceFt) <= SELECTED_ALTITUDE_MIN_DIFFERENCE_FT) {
    return undefined;
  }
  return `${differenceFt > 0 ? '^' : 'v'}${formatAltitudeHundreds(target.selectedAltitudeFt)}`;
}

/**
 * Builds the lines a target's data block shows during the clearance part of
 * the time-share: the same first line, over the altitude the crew has
 * selected, written as a flight strip writes a clearance - `^380` climbing
 * to FL380, `v290` descending to FL290. It is shown only while the aircraft
 * has more than {@link SELECTED_ALTITUDE_MIN_DIFFERENCE_FT} to go: a level
 * aircraft has selected the altitude it is at, and stays quiet.
 *
 * @param target - The target to describe.
 * @returns The clearance lines, or undefined if the aircraft is level, on the ground, or reports no selected altitude.
 */
export function formatClearanceDataBlock(target: ScopeTarget): DataBlockLines | undefined {
  const clearance = formatClearance(target);
  return clearance === undefined ? undefined : [formatIdentity(target), clearance];
}

/** The parts of the data block time-share, in the order they are shown. */
export type TimeSharePhase = 'usual' | 'type' | 'clearance';

/** Everything a target's data block can show, by part of the time-share. */
export interface DataBlockPhases {
  /** The usual lines: identity over altitude and ground speed. */
  usual: DataBlockLines;
  /** The type lines, when the aircraft's model or category is known. */
  type?: DataBlockLines;
  /** The clearance lines, while the aircraft is climbing or descending to a selected altitude. */
  clearance?: DataBlockLines;
}

/**
 * Builds everything a target's data block can show.
 *
 * @param target - The target to describe.
 * @returns The lines for each part of the time-share the target has something for.
 */
export function formatDataBlockPhases(target: ScopeTarget): DataBlockPhases {
  const type = formatTypeDataBlock(target);
  const clearance = formatClearanceDataBlock(target);
  return {
    usual: formatDataBlock(target),
    ...(type !== undefined && { type }),
    ...(clearance !== undefined && { clearance }),
  };
}

/**
 * Picks the lines a data block shows during one part of the time-share. A
 * block with nothing for that part shows its usual lines instead, so it
 * never goes blank.
 *
 * @param phases - Everything the block can show.
 * @param phase - The part of the time-share showing now.
 * @returns The lines to draw.
 */
export function dataBlockLinesFor(phases: DataBlockPhases, phase: TimeSharePhase): DataBlockLines {
  return phases[phase] ?? phases.usual;
}

/**
 * Every line a data block can show, for sizing it: a block is as wide as the
 * widest of them, so it does not move as the time-share turns.
 *
 * @param phases - Everything the block can show.
 * @returns Every line of every part.
 */
export function everyDataBlockLine(phases: DataBlockPhases): string[] {
  return [...phases.usual, ...(phases.type ?? []), ...(phases.clearance ?? [])];
}

/**
 * Decides which part of the time-share every data block is in at an instant.
 * Blocks time-share in unison, as on a real scope: the usual second line for
 * the first {@link TIME_SHARE_USUAL_MS} of each {@link TIME_SHARE_CYCLE_MS},
 * then the type for {@link TIME_SHARE_TYPE_MS}, then the clearance for
 * {@link TIME_SHARE_CLEARANCE_MS}.
 *
 * @param frameTimeMs - The animation clock, in milliseconds.
 * @returns The part showing now.
 */
export function timeSharePhase(frameTimeMs: number): TimeSharePhase {
  const inCycleMs = frameTimeMs % TIME_SHARE_CYCLE_MS;
  if (inCycleMs < TIME_SHARE_USUAL_MS) {
    return 'usual';
  }
  if (inCycleMs < TIME_SHARE_USUAL_MS + TIME_SHARE_TYPE_MS) {
    return 'type';
  }
  return 'clearance';
}
