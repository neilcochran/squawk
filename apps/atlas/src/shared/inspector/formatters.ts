import type { Airport, Airway, AirwayWaypoint, Fix, Navaid } from '@squawk/types';

/**
 * Centralized string formatters for the per-type inspector panel
 * renderers. Every function in this module is a pure transform from a
 * record field (or partial record) to a user-facing string. Switch
 * statements over discriminated-union types from `@squawk/types` live
 * here so the panel renderers stay focused on layout.
 *
 * If a panel needs a row-specific formatter that does not appear in
 * other panels (e.g. the airport runway summary), it still belongs in
 * this module - the consolidation point is "formatting" rather than
 * "shared between panels".
 */

/** Converts the FacilityType discriminator to a sentence-cased label. */
export function formatAirportFacilityType(type: Airport['facilityType']): string {
  switch (type) {
    case 'AIRPORT':
      return 'Airport';
    case 'HELIPORT':
      return 'Heliport';
    case 'SEAPLANE_BASE':
      return 'Seaplane base';
    case 'GLIDERPORT':
      return 'Gliderport';
    case 'ULTRALIGHT':
      return 'Ultralight';
    case 'BALLOONPORT':
      return 'Balloonport';
  }
}

/** Converts the FacilityStatus discriminator to a sentence-cased label. */
export function formatAirportStatus(status: Airport['status']): string {
  switch (status) {
    case 'OPEN':
      return 'Open';
    case 'CLOSED_INDEFINITELY':
      return 'Closed (indefinite)';
    case 'CLOSED_PERMANENTLY':
      return 'Closed (permanent)';
  }
}

/**
 * Builds a one-line "{length} ft x {width} ft, {surface}" runway summary,
 * skipping any field that is undefined in the source record. Returns
 * `'-'` when nothing is set so the row column has a visible value.
 */
export function formatAirportRunway(
  lengthFt: number | undefined,
  widthFt: number | undefined,
  surface: string | undefined,
): string {
  const parts: string[] = [];
  if (lengthFt !== undefined && widthFt !== undefined) {
    parts.push(`${lengthFt} x ${widthFt} ft`);
  } else if (lengthFt !== undefined) {
    parts.push(`${lengthFt} ft`);
  }
  if (surface !== undefined) {
    parts.push(surface);
  }
  return parts.length === 0 ? '-' : parts.join(', ');
}

/**
 * Formats the navaid frequency in the unit the dataset populated.
 * VOR-family stations have `frequencyMhz`; NDB-family stations have
 * `frequencyKhz`. A navaid carries at most one of these; if neither is
 * set, returns `null` so the row hides.
 */
export function formatNavaidFrequency(record: Navaid): string | null {
  if (record.frequencyMhz !== undefined) {
    return `${record.frequencyMhz.toFixed(2)} MHz`;
  }
  if (record.frequencyKhz !== undefined) {
    return `${record.frequencyKhz} kHz`;
  }
  return null;
}

/** Renders the magnetic variation as `{deg} {direction}` or null. */
export function formatNavaidMagVariation(record: Navaid): string | null {
  if (record.magneticVariationDeg === undefined) {
    return null;
  }
  const direction = record.magneticVariationDirection;
  return direction === undefined
    ? `${record.magneticVariationDeg} deg`
    : `${record.magneticVariationDeg} deg ${direction}`;
}

/** Converts the NavaidStatus discriminator to a sentence-cased label. */
export function formatNavaidStatus(status: Navaid['status']): string {
  switch (status) {
    case 'OPERATIONAL_IFR':
      return 'Operational (IFR)';
    case 'OPERATIONAL_RESTRICTED':
      return 'Operational (restricted)';
    case 'OPERATIONAL_VFR':
      return 'Operational (VFR only)';
    case 'SHUTDOWN':
      return 'Shutdown';
  }
}

/** Converts the FixUseCode discriminator to a sentence-cased label. */
export function formatFixUseCode(use: Fix['useCode']): string {
  switch (use) {
    case 'WP':
      return 'Waypoint';
    case 'RP':
      return 'Reporting point';
    case 'MW':
      return 'Military waypoint';
    case 'MR':
      return 'Military reporting point';
    case 'CN':
      return 'Computer nav';
    case 'VFR':
      return 'VFR waypoint';
    case 'NRS':
      return 'NRS waypoint';
    case 'RADAR':
      return 'Radar fix';
  }
}

/** Converts the AirwayType discriminator to a sentence-cased label. */
export function formatAirwayType(type: Airway['type']): string {
  switch (type) {
    case 'VICTOR':
      return 'Victor (low altitude)';
    case 'JET':
      return 'Jet (high altitude)';
    case 'RNAV_T':
      return 'RNAV T (low altitude)';
    case 'RNAV_Q':
      return 'RNAV Q (high altitude)';
    case 'ATLANTIC':
      return 'Atlantic';
    case 'BAHAMA':
      return 'Bahama';
    case 'PACIFIC':
      return 'Pacific';
    case 'PUERTO_RICO':
      return 'Puerto Rico';
    case 'GREEN':
      return 'Green';
    case 'RED':
      return 'Red';
    case 'AMBER':
      return 'Amber';
    case 'BLUE':
      return 'Blue';
  }
}

/** Converts the AirwayRegion discriminator to a sentence-cased label. */
export function formatAirwayRegion(region: Airway['region']): string {
  switch (region) {
    case 'US':
      return 'US';
    case 'ALASKA':
      return 'Alaska';
    case 'HAWAII':
      return 'Hawaii';
  }
}

/**
 * Builds the right-hand cell for a waypoint row. Prefers `MEA / MAA`
 * when both are present, falls back to MEA alone, then MOCA, then a
 * placeholder hyphen so empty rows still show a visible value column.
 */
export function formatAirwayWaypointAltitude(waypoint: AirwayWaypoint): string {
  const mea = waypoint.minimumEnrouteAltitudeFt;
  const maa = waypoint.maximumAuthorizedAltitudeFt;
  const moca = waypoint.minimumObstructionClearanceAltitudeFt;
  if (mea !== undefined && maa !== undefined) {
    return `${mea} - ${maa}`;
  }
  if (mea !== undefined) {
    return `MEA ${mea}`;
  }
  if (moca !== undefined) {
    return `MOCA ${moca}`;
  }
  return '-';
}
