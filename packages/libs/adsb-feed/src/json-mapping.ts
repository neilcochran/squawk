import { AircraftCategory } from '@squawk/types';
import type { AircraftCategory as AircraftCategoryValue, EmergencyState } from '@squawk/types';

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
 * than attempting to parse `"ground"` as a number.
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

  return update;
}
