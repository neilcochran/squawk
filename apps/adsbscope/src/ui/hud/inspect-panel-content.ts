import type { ScopeAircraftDetails, ScopeTarget } from '../../shared/protocol.js';
import { formatDataBlock } from '../scope/data-block.js';
import { formatCompassLabel, FULL_CIRCLE_DEG } from '../scope/furniture.js';

/** One labeled value in the inspect panel. */
export interface InspectRow {
  /** What the value is. */
  label: string;
  /** The value, formatted for reading. */
  value: string;
}

/** What the inspect panel shows for an aircraft. */
export interface InspectContent {
  /** The aircraft's callsign (or ICAO hex) and emergency code, as on the first line of its data block. */
  title: string;
  /** Everything known about the aircraft, in reading order. A value that is not known has no row. */
  rows: InspectRow[];
}

/** Shown in place of a value that is not known, where the row is always present. */
export const UNKNOWN_VALUE = '-';

/** Vertical rate, in feet per minute, below which an aircraft is described as level. */
export const LEVEL_FLIGHT_FT_PER_MIN = 100;

const MS_PER_SECOND = 1000;

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function formatBearing(bearingDeg: number): string {
  return `${formatCompassLabel(Math.round(bearingDeg) % FULL_CIRCLE_DEG)} true`;
}

function formatAltitude(target: ScopeTarget): string {
  if (target.onGround === true) {
    return 'on the ground';
  }
  return target.altitudeFt === undefined ? UNKNOWN_VALUE : `${formatNumber(target.altitudeFt)} ft`;
}

function formatVerticalRate(verticalRateFtPerMin: number): string {
  if (Math.abs(verticalRateFtPerMin) < LEVEL_FLIGHT_FT_PER_MIN) {
    return 'level';
  }
  const sign = verticalRateFtPerMin > 0 ? '+' : '-';
  return `${sign}${formatNumber(Math.abs(verticalRateFtPerMin))} ft/min`;
}

/**
 * Builds the inspect panel's content for an aircraft: the values a data
 * block abbreviates or has no room for, written out in full. Identity,
 * altitude, and position always have a row, so the panel keeps its shape;
 * the rest appear only once the aircraft has reported them. What the
 * registry records about the aircraft is added once it has loaded, and is
 * simply absent for an aircraft the registry does not know.
 *
 * @param target - The selected aircraft.
 * @param now - Unix epoch ms of the snapshot the aircraft came from.
 * @param details - What the registry records about the aircraft, if it has loaded and there is any.
 * @returns The panel's title and rows.
 */
export function buildInspectContent(
  target: ScopeTarget,
  now: number,
  details: ScopeAircraftDetails | undefined,
): InspectContent {
  const rows: InspectRow[] = [{ label: 'ICAO hex', value: target.icaoHex.toUpperCase() }];
  if (details !== undefined) {
    rows.push({ label: 'Registration', value: details.registration });
  }
  if (details?.make !== undefined) {
    rows.push({ label: 'Make', value: details.make });
  }
  const model = target.aircraftModel ?? details?.model;
  if (model !== undefined) {
    rows.push({ label: 'Model', value: model });
  }
  if (details?.operator !== undefined) {
    rows.push({ label: 'Operator', value: details.operator });
  }
  if (details?.yearManufactured !== undefined) {
    rows.push({ label: 'Built', value: String(details.yearManufactured) });
  }
  if (target.squawk !== undefined) {
    rows.push({ label: 'Squawk', value: target.squawk });
  }
  rows.push({ label: 'Altitude', value: formatAltitude(target) });
  if (target.verticalRateFtPerMin !== undefined && target.onGround !== true) {
    rows.push({ label: 'Vertical', value: formatVerticalRate(target.verticalRateFtPerMin) });
  }
  if (target.groundSpeedKt !== undefined) {
    rows.push({ label: 'Speed', value: `${formatNumber(target.groundSpeedKt)} kt` });
  }
  if (target.trueTrackDeg !== undefined) {
    rows.push({ label: 'Track', value: formatBearing(target.trueTrackDeg) });
  }
  rows.push({
    label: 'Position',
    value:
      target.position === undefined
        ? 'not yet known'
        : `${formatBearing(target.position.trueBearingDeg)}, ${target.position.rangeNm.toFixed(1)} nm`,
  });
  const heardSecondsAgo = Math.max(0, Math.round((now - target.lastSeenAt) / MS_PER_SECOND));
  rows.push({ label: 'Heard', value: `${heardSecondsAgo} s ago` });
  return { title: formatDataBlock(target)[0], rows };
}
