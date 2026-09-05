import type {
  AcasResolutionAdvisoryReport,
  Aircraft,
  AircraftRegistration,
  Airport,
  Coordinates,
  EmergencyState,
  Position,
  ResolutionAdvisoryType,
  TargetStateAndStatus,
} from '@squawk/types';

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

function formatBoolean(value: boolean | undefined): string {
  return value === true ? 'Yes' : '-';
}

/** Human-readable label per {@link EmergencyState} value. */
const EMERGENCY_STATE_LABELS: Record<EmergencyState, string> = {
  none: 'None',
  general: 'General',
  lifeguardMedical: 'Lifeguard/medical',
  minimumFuel: 'Minimum fuel',
  noCommunications: 'No communications',
  unlawfulInterference: 'Unlawful interference',
  downed: 'Downed aircraft',
  reserved: 'Reserved',
};

function formatEmergencyState(emergencyState: EmergencyState | undefined): string {
  return emergencyState === undefined ? '-' : EMERGENCY_STATE_LABELS[emergencyState];
}

/** Human-readable label per {@link ResolutionAdvisoryType} value. */
const RESOLUTION_ADVISORY_LABELS: Record<ResolutionAdvisoryType, string> = {
  climb: 'Climb',
  descend: 'Descend',
  crossingClimb: 'Crossing climb',
  crossingDescend: 'Crossing descend',
  increaseClimb: 'Increase climb',
  increaseDescent: 'Increase descent',
  reduceClimb: 'Reduce climb',
  reduceDescent: 'Reduce descent',
  doNotClimb: 'Do not climb',
  doNotDescend: 'Do not descend',
  reversalToClimb: 'Reversal to climb',
  reversalToDescend: 'Reversal to descend',
};

// '-' means the source never decoded an RA report; 'None' means it did and no advisory is active - the two are deliberately distinct.
function formatResolutionAdvisory(ra: AcasResolutionAdvisoryReport | undefined): string {
  if (ra === undefined) {
    return '-';
  }
  if (!ra.active) {
    return 'None';
  }
  if (ra.advisoryType === undefined) {
    return ra.multipleThreat ? 'Active (multi-threat)' : 'Active';
  }
  const typeLabel = RESOLUTION_ADVISORY_LABELS[ra.advisoryType];
  return ra.corrective ? typeLabel : `${typeLabel} (preventive)`;
}

function formatTargetState(targetState: TargetStateAndStatus | undefined): string {
  if (targetState === undefined) {
    return '-';
  }
  const parts: string[] = [];
  const altitude = formatFeet(targetState.selectedAltitudeFt);
  if (altitude !== '-') {
    parts.push(`${altitude} sel`);
  }
  const heading = formatDegrees(targetState.selectedHeadingDeg);
  if (heading !== '-') {
    parts.push(`${heading} sel`);
  }
  if (targetState.autopilotEngaged === true) {
    parts.push('AP on');
  }
  return parts.length === 0 ? '-' : parts.join(', ');
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
    { label: 'Squawk alert', value: formatBoolean(aircraft.squawkAlert) },
    { label: 'Ident active', value: formatBoolean(aircraft.identActive) },
    { label: 'Emergency state', value: formatEmergencyState(aircraft.emergencyState) },
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
    { label: 'Resolution advisory', value: formatResolutionAdvisory(aircraft.resolutionAdvisory) },
    { label: 'Target state', value: formatTargetState(aircraft.targetState) },
    { label: 'Origin', value: formatAirport(aircraft.origin) },
    { label: 'Destination', value: formatAirport(aircraft.destination) },
    { label: 'Last seen', value: `${formatAge(aircraft.lastSeenAt, nowMs)} ago` },
  ];
}
