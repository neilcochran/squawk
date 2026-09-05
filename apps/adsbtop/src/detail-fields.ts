import type { Aircraft, AircraftRegistration, Airport, Coordinates, Position } from '@squawk/types';

import {
  formatAge,
  formatBearing,
  formatDistance,
  formatGroundSpeed,
  formatOnGround,
  formatVerticalRate,
} from './format.js';
import { bearingToAircraftDeg, distanceToAircraftNm } from './location.js';

/** One labeled row in the aircraft detail view. */
export interface DetailField {
  /** Row label. */
  label: string;
  /** Formatted value, or `'-'` if not populated by the current source. */
  value: string;
}

function formatFeet(valueFt: number | undefined): string {
  return valueFt === undefined ? '-' : `${Math.round(valueFt)}ft`;
}

function formatKnots(valueKt: number | undefined): string {
  return valueKt === undefined ? '-' : `${Math.round(valueKt)}kt`;
}

function formatDegrees(valueDeg: number | undefined): string {
  return valueDeg === undefined ? '-' : `${Math.round(valueDeg)}°`;
}

function formatPosition(position: Position | undefined): string {
  return position === undefined ? '-' : `${position.lat.toFixed(4)}, ${position.lon.toFixed(4)}`;
}

function formatRegistration(registration: AircraftRegistration | undefined): string {
  if (registration === undefined) {
    return '-';
  }
  const makeModel = [registration.make, registration.model]
    .filter((part) => part !== undefined)
    .join(' ');
  return makeModel === '' ? registration.registration : `${registration.registration} ${makeModel}`;
}

function formatAirport(airport: Airport | undefined): string {
  return airport === undefined ? '-' : (airport.icao ?? airport.faaId);
}

/**
 * Builds the full labeled field list for the `[Enter]/[D]etail` view: every
 * `Aircraft` field, in a fixed order, formatted for display with `'-'` for
 * anything the active source hasn't populated. Deliberately does not
 * collapse baro/geo altitude or true/magnetic heading into one value the way
 * the table's compact columns do - showing both is the point of a "full
 * field dump" view.
 *
 * @param aircraft - The selected aircraft to build fields for.
 * @param nowMs - Current time, for the "last seen" age.
 * @param location - The configured receiver location (`--lat`/`--lon`), if any. Adds Distance/Bearing rows after Position when set; omitted entirely otherwise, matching the table's Dist/Brg columns.
 * @returns Labeled rows in display order.
 */
export function buildDetailFields(
  aircraft: Aircraft,
  nowMs: number,
  location: Coordinates | undefined,
): DetailField[] {
  const locationFields: DetailField[] =
    location === undefined
      ? []
      : [
          { label: 'Distance', value: formatDistance(distanceToAircraftNm(location, aircraft)) },
          { label: 'Bearing', value: formatBearing(bearingToAircraftDeg(location, aircraft)) },
        ];

  return [
    { label: 'ICAO', value: aircraft.icaoHex },
    { label: 'Callsign', value: aircraft.callsign ?? '-' },
    { label: 'Squawk', value: aircraft.squawk ?? '-' },
    { label: 'Registration', value: formatRegistration(aircraft.registration) },
    { label: 'Position', value: formatPosition(aircraft.position) },
    ...locationFields,
    { label: 'Baro altitude', value: formatFeet(aircraft.position?.baroAltitudeFt) },
    { label: 'Geo altitude', value: formatFeet(aircraft.position?.geoAltitudeFt) },
    { label: 'Ground speed', value: formatGroundSpeed(aircraft) },
    { label: 'Indicated airspeed', value: formatKnots(aircraft.indicatedAirspeedKt) },
    { label: 'True airspeed', value: formatKnots(aircraft.trueAirspeedKt) },
    { label: 'True track', value: formatDegrees(aircraft.trueTrackDeg) },
    { label: 'Magnetic heading', value: formatDegrees(aircraft.magneticHeadingDeg) },
    { label: 'Vertical rate', value: formatVerticalRate(aircraft) },
    { label: 'On ground', value: formatOnGround(aircraft) },
    { label: 'Category', value: aircraft.category ?? '-' },
    { label: 'Origin', value: formatAirport(aircraft.origin) },
    { label: 'Destination', value: formatAirport(aircraft.destination) },
    { label: 'Last seen', value: `${formatAge(aircraft.lastSeenAt, nowMs)} ago` },
  ];
}
