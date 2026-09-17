import type {
  AcasResolutionAdvisoryReport,
  Aircraft,
  AircraftRegistration,
  Airport,
  Coordinates,
  EmergencyState,
  ResolutionAdvisoryType,
  TargetStateAndStatus,
} from '@squawk/types';

import { formatCategoryLabel } from './category.js';
import { closestPointOfApproach } from './cpa.js';
import {
  formatAge,
  formatBearing,
  formatClosestApproach,
  formatDistance,
  formatGroundSpeed,
  formatOnGround,
  formatPosition,
  formatVerticalRate,
} from './format.js';
import { bearingToAircraftDeg, distanceToAircraftNm } from './location.js';
import { formatAltitudeValue, formatSpeedValue } from './units.js';
import type { UnitSystem } from './units.js';

/** One labeled row in the aircraft detail view. */
export interface DetailField {
  /** Row label. */
  label: string;
  /** Formatted value, or `'-'` if not populated by the current source. */
  value: string;
}

function formatDegrees(valueDeg: number | undefined): string {
  return valueDeg === undefined ? '-' : `${Math.round(valueDeg)}°`;
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

function formatTargetState(
  targetState: TargetStateAndStatus | undefined,
  units: UnitSystem,
): string {
  if (targetState === undefined) {
    return '-';
  }
  const parts: string[] = [];
  const altitude = formatAltitudeValue(targetState.selectedAltitudeFt, units);
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
 * @param location - The configured receiver location (`--lat`/`--lon`), if any. Adds Distance/Bearing/Closest approach rows after Position when set; omitted entirely otherwise, matching the table's Dist/Brg/CPA columns.
 * @param messageCount - Update events adsbtop has observed for this aircraft since it was first (or most recently) tracked.
 * @param units - The unit system to render altitudes, speeds, and distances in.
 * @returns Labeled rows in display order.
 */
export function buildDetailFields(
  aircraft: Aircraft,
  nowMs: number,
  location: Coordinates | undefined,
  messageCount: number,
  units: UnitSystem,
): DetailField[] {
  const locationFields: DetailField[] =
    location === undefined
      ? []
      : [
          {
            label: 'Distance',
            value: formatDistance(distanceToAircraftNm(location, aircraft), units),
          },
          { label: 'Bearing', value: formatBearing(bearingToAircraftDeg(location, aircraft)) },
          {
            label: 'Closest approach',
            value: formatClosestApproach(closestPointOfApproach(location, aircraft), units),
          },
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
    {
      label: 'Baro altitude',
      value: formatAltitudeValue(aircraft.position?.baroAltitudeFt, units),
    },
    { label: 'Geo altitude', value: formatAltitudeValue(aircraft.position?.geoAltitudeFt, units) },
    { label: 'Ground speed', value: formatGroundSpeed(aircraft, units) },
    { label: 'Indicated airspeed', value: formatSpeedValue(aircraft.indicatedAirspeedKt, units) },
    { label: 'True airspeed', value: formatSpeedValue(aircraft.trueAirspeedKt, units) },
    { label: 'True track', value: formatDegrees(aircraft.trueTrackDeg) },
    { label: 'Magnetic heading', value: formatDegrees(aircraft.magneticHeadingDeg) },
    { label: 'Vertical rate', value: formatVerticalRate(aircraft, units) },
    { label: 'On ground', value: formatOnGround(aircraft) },
    { label: 'Category', value: formatCategoryLabel(aircraft.category) },
    { label: 'Resolution advisory', value: formatResolutionAdvisory(aircraft.resolutionAdvisory) },
    { label: 'Target state', value: formatTargetState(aircraft.targetState, units) },
    { label: 'Origin', value: formatAirport(aircraft.origin) },
    { label: 'Destination', value: formatAirport(aircraft.destination) },
    { label: 'Messages', value: String(messageCount) },
    { label: 'Last seen', value: `${formatAge(aircraft.lastSeenAt, nowMs)} ago` },
  ];
}
