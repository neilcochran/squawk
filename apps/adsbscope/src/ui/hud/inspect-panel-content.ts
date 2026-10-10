import type {
  ScopeAircraftDetails,
  ScopeAirspace,
  ScopeAirspaceKind,
  ScopeAutopilot,
  ScopeAutopilotMode,
  ScopeTarget,
} from '../../shared/protocol.js';
import { categoryLabel } from '../scope/category.js';
import { formatDataBlock } from '../scope/data-block.js';
import { formatHeading, formatPolarPosition, formatTrueBearing } from '../scope/position-format.js';

/** One labeled value in the inspect panel. */
export interface InspectRow {
  /** What the value is. */
  label: string;
  /** The value, formatted for reading. */
  value: string;
}

/** What the inspect panel shows for an aircraft. */
export interface InspectContent {
  /** The aircraft's callsign (or ICAO hex) and emergency or ident code, as on the first line of its data block. */
  title: string;
  /** Everything known about the aircraft, in reading order. A value that is not known has no row. */
  rows: InspectRow[];
}

/** Shown in place of a value that is not known, where the row is always present. */
export const UNKNOWN_VALUE = '-';

/** Vertical rate, in feet per minute, below which an aircraft is described as level. */
export const LEVEL_FLIGHT_FT_PER_MIN = 100;

/** Added to the squawk while the transponder flags that the code has just changed. */
export const SQUAWK_ALERT_NOTE = 'just changed';

/** Shown in the Airspace row for an aircraft in none of the airspace the scope checks. The data cannot tell Class E from G, so the row does not try. */
export const OUTSIDE_AIRSPACE = 'outside Class B, C, D';

const MS_PER_SECOND = 1000;

/** How a Class B, C, or D is written in the Airspace row, before its airport. A special-use area is written as charted, with nothing before it: its designator says what it is. */
const AIRSPACE_CLASS_LABELS: Readonly<Partial<Record<ScopeAirspaceKind, string>>> = {
  classB: 'Class B',
  classC: 'Class C',
  classD: 'Class D',
};

/** How each autopilot mode is written in the Autopilot row, after whether the autopilot is on. */
const AUTOPILOT_MODE_LABELS: Readonly<Record<ScopeAutopilotMode, string>> = {
  vnav: 'VNAV',
  altitudeHold: 'altitude hold',
  approach: 'approach',
  lnav: 'LNAV',
};

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
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

function formatSquawk(squawk: string, target: ScopeTarget): string {
  return target.squawkAlert === true ? `${squawk}, ${SQUAWK_ALERT_NOTE}` : squawk;
}

function formatAirspeed(target: ScopeTarget): string | undefined {
  const parts: string[] = [];
  if (target.indicatedAirspeedKt !== undefined) {
    parts.push(`${formatNumber(target.indicatedAirspeedKt)} kt indicated`);
  }
  if (target.trueAirspeedKt !== undefined) {
    parts.push(`${formatNumber(target.trueAirspeedKt)} kt true`);
  }
  return parts.length === 0 ? undefined : parts.join(', ');
}

function formatAutopilot(autopilot: ScopeAutopilot): string {
  return [
    autopilot.engaged ? 'on' : 'off',
    ...autopilot.modes.map((mode) => AUTOPILOT_MODE_LABELS[mode]),
  ].join(', ');
}

function formatAirspace(airspace: ScopeAirspace[]): string {
  if (airspace.length === 0) {
    return OUTSIDE_AIRSPACE;
  }
  return airspace
    .map((entry) => {
      const classLabel = AIRSPACE_CLASS_LABELS[entry.kind];
      return classLabel === undefined ? entry.name : `${classLabel} (${entry.name})`;
    })
    .join(', ');
}

/**
 * Builds the inspect panel's content for an aircraft: the values a data
 * block abbreviates or has no room for, written out in full. Identity,
 * altitude, and position always have a row, so the panel keeps its shape;
 * the rest appear only once the aircraft has reported them, so nothing ever
 * reads as "off" under a source that cannot report it. What the registry
 * records about the aircraft is added once it has loaded, and is simply
 * absent for an aircraft the registry does not know.
 *
 * The squawk notes a code that has just changed. The selected heading
 * carries no `true` or `magnetic`: the broadcast does not say which it is.
 * The airspace row lists every airspace the server placed the aircraft in,
 * special-use areas as charted and classes by their airport, and reads
 * {@link OUTSIDE_AIRSPACE} when there is none; it is absent when the
 * aircraft could not be placed at all.
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
  const category = categoryLabel(target.category);
  if (category !== undefined) {
    rows.push({ label: 'Category', value: category });
  }
  if (details?.operator !== undefined) {
    rows.push({ label: 'Operator', value: details.operator });
  }
  if (details?.yearManufactured !== undefined) {
    rows.push({ label: 'Built', value: String(details.yearManufactured) });
  }
  if (target.squawk !== undefined) {
    rows.push({ label: 'Squawk', value: formatSquawk(target.squawk, target) });
  }
  rows.push({ label: 'Altitude', value: formatAltitude(target) });
  if (target.selectedAltitudeFt !== undefined) {
    rows.push({
      label: 'Selected altitude',
      value: `${formatNumber(target.selectedAltitudeFt)} ft`,
    });
  }
  if (target.verticalRateFtPerMin !== undefined && target.onGround !== true) {
    rows.push({ label: 'Vertical', value: formatVerticalRate(target.verticalRateFtPerMin) });
  }
  if (target.groundSpeedKt !== undefined) {
    rows.push({ label: 'Ground speed', value: `${formatNumber(target.groundSpeedKt)} kt` });
  }
  const airspeed = formatAirspeed(target);
  if (airspeed !== undefined) {
    rows.push({ label: 'Airspeed', value: airspeed });
  }
  if (target.trueTrackDeg !== undefined) {
    rows.push({ label: 'Track', value: formatTrueBearing(target.trueTrackDeg) });
  }
  if (target.magneticHeadingDeg !== undefined) {
    rows.push({ label: 'Heading', value: `${formatHeading(target.magneticHeadingDeg)} magnetic` });
  }
  if (target.selectedHeadingDeg !== undefined) {
    rows.push({ label: 'Selected heading', value: formatHeading(target.selectedHeadingDeg) });
  }
  if (target.autopilot !== undefined) {
    rows.push({ label: 'Autopilot', value: formatAutopilot(target.autopilot) });
  }
  rows.push({
    label: 'Position',
    value: target.position === undefined ? 'not yet known' : formatPolarPosition(target.position),
  });
  if (target.airspace !== undefined) {
    rows.push({ label: 'Airspace', value: formatAirspace(target.airspace) });
  }
  const heardSecondsAgo = Math.max(0, Math.round((now - target.lastSeenAt) / MS_PER_SECOND));
  rows.push({ label: 'Heard', value: `${heardSecondsAgo} s ago` });
  return { title: formatDataBlock(target)[0], rows };
}
