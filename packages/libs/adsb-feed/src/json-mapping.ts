import { AircraftCategory } from '@squawk/types';
import type {
  AircraftCategory as AircraftCategoryValue,
  EmergencyState,
  TargetStateAndStatus,
} from '@squawk/types';

import type { AircraftUpdate } from './tracker.js';

/**
 * Maps dump1090-fa's `emergency` JSON string (from its own `net_io.c`
 * `emergency_enum_string`) to squawk's {@link EmergencyState}. Values are
 * the raw 3-bit ADS-B emergency/priority state field spelled out as words -
 * dump1090-fa's own `dump1090.h` documents `EMERGENCY_NONE` through
 * `EMERGENCY_RESERVED` as matching that field's encoding directly, so this
 * is a 1:1 rename rather than a lossy remap.
 */
const EMERGENCY_STATE_MAP: Readonly<Record<string, EmergencyState>> = {
  none: 'none',
  general: 'general',
  lifeguard: 'lifeguardMedical',
  minfuel: 'minimumFuel',
  nordo: 'noCommunications',
  unlawful: 'unlawfulInterference',
  downed: 'downed',
  reserved: 'reserved',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAircraftCategoryCode(value: string): value is keyof typeof AircraftCategory {
  return Object.hasOwn(AircraftCategory, value);
}

/**
 * Maps a raw `category` code (e.g. `"A3"`) from `aircraft.json` to the
 * friendly {@link AircraftCategoryValue} squawk uses, or undefined if the
 * code is missing or unrecognized.
 */
function mapCategory(raw: unknown): AircraftCategoryValue | undefined {
  return typeof raw === 'string' && isAircraftCategoryCode(raw) ? AircraftCategory[raw] : undefined;
}

/** Maps a raw `emergency` string from `aircraft.json` via {@link EMERGENCY_STATE_MAP}, or undefined if missing or unrecognized. */
function mapEmergencyState(raw: unknown): EmergencyState | undefined {
  return typeof raw === 'string' ? EMERGENCY_STATE_MAP[raw] : undefined;
}

function numberOrUndefined(raw: unknown): number | undefined {
  return typeof raw === 'number' ? raw : undefined;
}

/**
 * Reads the `nav_modes` array of `aircraft.json`: the names of the autopilot
 * and navigation modes dump1090-fa found engaged (`autopilot`, `vnav`,
 * `althold`, `approach`, `lnav`, `tcas`). Undefined when the field is absent,
 * which dump1090-fa writes when the aircraft reports no mode status at all.
 */
function mapNavModes(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return raw.filter((mode): mode is string => typeof mode === 'string');
}

/**
 * Maps the `nav_*` fields of an `aircraft.json` entry - dump1090-fa's own
 * decode of the aircraft's Target State and Status (BDS 6,2) - to a
 * {@link TargetStateAndStatus}, or undefined when the entry carries none of
 * them.
 *
 * dump1090-fa splits the selected altitude by source into `nav_altitude_mcp`
 * and `nav_altitude_fms`; the MCP/FCU value is preferred when both are
 * present, since it is what the crew has dialed in. The mode flags come from
 * `nav_modes`, which dump1090-fa writes only when the aircraft reports its
 * mode status, so they are undefined when it is absent - as is TCAS
 * operational status, which dump1090-fa reports as the `tcas` mode and only
 * alongside the others. The accuracy and integrity fields come from the
 * entry's top-level `nac_p`, `nic_baro`, and `sil`; when an entry lacks one,
 * the value is the standard's own "unknown" encoding (0, or false for
 * `nic_baro`), which is also what an aircraft that cannot say transmits.
 */
function mapTargetState(raw: Record<string, unknown>): TargetStateAndStatus | undefined {
  const mcpAltitudeFt = numberOrUndefined(raw.nav_altitude_mcp);
  const fmsAltitudeFt = numberOrUndefined(raw.nav_altitude_fms);
  const selectedHeadingDeg = numberOrUndefined(raw.nav_heading);
  const baroPressureSettingMb = numberOrUndefined(raw.nav_qnh);
  const modes = mapNavModes(raw.nav_modes);
  if (
    mcpAltitudeFt === undefined &&
    fmsAltitudeFt === undefined &&
    selectedHeadingDeg === undefined &&
    baroPressureSettingMb === undefined &&
    modes === undefined
  ) {
    return undefined;
  }
  let selectedAltitudeSource: TargetStateAndStatus['selectedAltitudeSource'];
  if (mcpAltitudeFt !== undefined) {
    selectedAltitudeSource = 'mcpFcu';
  } else if (fmsAltitudeFt !== undefined) {
    selectedAltitudeSource = 'fms';
  }
  const modeActive = (mode: string): boolean | undefined =>
    modes === undefined ? undefined : modes.includes(mode);
  return {
    selectedAltitudeSource,
    selectedAltitudeFt: mcpAltitudeFt ?? fmsAltitudeFt,
    baroPressureSettingMb,
    selectedHeadingDeg,
    navAccuracyCategoryPosition: numberOrUndefined(raw.nac_p) ?? 0,
    nicBaro: raw.nic_baro === 1,
    sourceIntegrityLevel: numberOrUndefined(raw.sil) ?? 0,
    autopilotEngaged: modeActive('autopilot'),
    vnavModeActive: modeActive('vnav'),
    altitudeHoldModeActive: modeActive('althold'),
    approachModeActive: modeActive('approach'),
    lnavModeActive: modeActive('lnav'),
    tcasOperational: modeActive('tcas') === true,
  };
}

/**
 * Extracts the `aircraft` array from a parsed dump1090-fa `aircraft.json`
 * response body. Returns an empty array if the response is not shaped as
 * expected, so a malformed poll cycle is skipped rather than throwing.
 *
 * @param parsed - The `JSON.parse`d response body.
 * @returns The raw aircraft entries, unvalidated.
 */
export function extractAircraftRecords(parsed: unknown): unknown[] {
  if (!isRecord(parsed) || !Array.isArray(parsed.aircraft)) {
    return [];
  }
  return parsed.aircraft as unknown[];
}

/**
 * Maps one raw `aircraft.json` aircraft entry to a partial {@link AircraftUpdate}.
 *
 * dump1090-fa reports `alt_baro` as either a number or the literal string
 * `"ground"` when the aircraft's own squitter indicates surface status; the
 * latter is mapped to `onGround: true` with no barometric altitude rather
 * than attempting to parse `"ground"` as a number. The `nav_*` fields -
 * selected altitude and heading, altimeter setting, and engaged autopilot
 * modes - are gathered into `targetState`.
 *
 * @param raw - One entry from the `aircraft.json` `aircraft` array.
 * @returns A partial update ready for `Tracker.ingest`, or undefined if the entry has no usable ICAO hex address.
 */
export function mapJsonAircraft(raw: unknown): AircraftUpdate | undefined {
  if (!isRecord(raw) || typeof raw.hex !== 'string' || raw.hex.length === 0) {
    return undefined;
  }

  const update: AircraftUpdate = { icaoHex: raw.hex.toUpperCase() };

  if (typeof raw.flight === 'string' && raw.flight.trim().length > 0) {
    update.callsign = raw.flight.trim();
  }
  if (typeof raw.lat === 'number' && typeof raw.lon === 'number') {
    update.lat = raw.lat;
    update.lon = raw.lon;
  }
  if (raw.alt_baro === 'ground') {
    update.onGround = true;
  } else if (typeof raw.alt_baro === 'number') {
    update.onGround = false;
    update.baroAltitudeFt = raw.alt_baro;
  }
  if (typeof raw.alt_geom === 'number') {
    update.geoAltitudeFt = raw.alt_geom;
  }
  if (typeof raw.gs === 'number') {
    update.groundSpeedKt = raw.gs;
  }
  if (typeof raw.ias === 'number') {
    update.indicatedAirspeedKt = raw.ias;
  }
  if (typeof raw.tas === 'number') {
    update.trueAirspeedKt = raw.tas;
  }
  if (typeof raw.track === 'number') {
    update.trueTrackDeg = raw.track;
  }
  if (typeof raw.mag_heading === 'number') {
    update.magneticHeadingDeg = raw.mag_heading;
  }
  const verticalRate = raw.baro_rate ?? raw.geom_rate;
  if (typeof verticalRate === 'number') {
    update.verticalRateFtPerMin = verticalRate;
  }
  if (typeof raw.squawk === 'string') {
    update.squawk = raw.squawk;
  }
  const category = mapCategory(raw.category);
  if (category !== undefined) {
    update.category = category;
  }
  const emergencyState = mapEmergencyState(raw.emergency);
  if (emergencyState !== undefined) {
    update.emergencyState = emergencyState;
  }
  const targetState = mapTargetState(raw);
  if (targetState !== undefined) {
    update.targetState = targetState;
  }

  return update;
}
