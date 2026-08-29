import type { AircraftUpdate } from './tracker.js';

/** 0-indexed field positions in an SBS/BaseStation `MSG` record. */
const FIELD = {
  MESSAGE_TYPE: 0,
  HEX_IDENT: 4,
  CALLSIGN: 10,
  ALTITUDE: 11,
  GROUND_SPEED: 12,
  TRACK: 13,
  LATITUDE: 14,
  LONGITUDE: 15,
  VERTICAL_RATE: 16,
  SQUAWK: 17,
  ON_GROUND: 21,
} as const;

function field(fields: string[], index: number): string | undefined {
  const value = fields[index];
  return value !== undefined && value.length > 0 ? value : undefined;
}

function numericField(fields: string[], index: number): number | undefined {
  const raw = field(fields, index);
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Parses one line of dump1090-fa's SBS/BaseStation output into a partial
 * {@link AircraftUpdate}.
 *
 * Only `MSG` records carry aircraft data (`SEL`, `ID`, `AIR`, `STA`, `CLK`
 * are session/administrative record types and are ignored). Unlike
 * `aircraft.json`'s one-snapshot-per-aircraft shape, each SBS line is a
 * fragment - which fields are populated depends on the line's transmission
 * type (1-8). Rather than gating on transmission type, this simply reads
 * whatever fields are present: a field a given type never populates is
 * blank in the CSV and is skipped the same way any other unpopulated field
 * is, so it tolerates real-world variation in exactly which fields a given
 * transmission type fills in.
 *
 * @param line - One raw line from the SBS TCP stream, without its trailing newline.
 * @returns A partial update ready for `Tracker.ingest`, or undefined if the line is not a usable `MSG` record.
 */
export function parseSbsLine(line: string): AircraftUpdate | undefined {
  const fields = line.split(',');
  if (field(fields, FIELD.MESSAGE_TYPE) !== 'MSG') {
    return undefined;
  }
  const hexIdent = field(fields, FIELD.HEX_IDENT);
  if (!hexIdent) {
    return undefined;
  }

  const update: AircraftUpdate = { icaoHex: hexIdent.toUpperCase() };

  const callsign = field(fields, FIELD.CALLSIGN)?.trim();
  if (callsign) {
    update.callsign = callsign;
  }
  const lat = numericField(fields, FIELD.LATITUDE);
  const lon = numericField(fields, FIELD.LONGITUDE);
  if (lat !== undefined && lon !== undefined) {
    update.lat = lat;
    update.lon = lon;
  }
  const altitude = numericField(fields, FIELD.ALTITUDE);
  if (altitude !== undefined) {
    update.baroAltitudeFt = altitude;
  }
  const groundSpeed = numericField(fields, FIELD.GROUND_SPEED);
  if (groundSpeed !== undefined) {
    update.groundSpeedKt = groundSpeed;
  }
  const track = numericField(fields, FIELD.TRACK);
  if (track !== undefined) {
    update.trueTrackDeg = track;
  }
  const verticalRate = numericField(fields, FIELD.VERTICAL_RATE);
  if (verticalRate !== undefined) {
    update.verticalRateFtPerMin = verticalRate;
  }
  const squawk = field(fields, FIELD.SQUAWK);
  if (squawk) {
    update.squawk = squawk;
  }
  const onGround = field(fields, FIELD.ON_GROUND);
  if (onGround === '0' || onGround === '1') {
    update.onGround = onGround === '1';
  }

  return update;
}
