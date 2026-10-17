import type {
  Airport,
  Airway,
  AirwayDirection,
  AirwayWaypoint,
  Fix,
  FixNavaidAssociation,
  Navaid,
  NavaidCheckpoint,
} from '@squawk/types';

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

/**
 * Formats a VOR receiver checkpoint as the radial the receiver should
 * indicate there and where it is used: `"R-133, ground"`, or
 * `"R-090, airborne at 3000 ft MSL"` for an airborne checkpoint with a
 * published altitude. Radials take the conventional three digits.
 */
export function formatNavaidCheckpoint(checkpoint: NavaidCheckpoint): string {
  const radial = `R-${checkpoint.magneticBearingDeg.toFixed(0).padStart(3, '0')}`;
  if (checkpoint.type === 'GROUND') {
    return `${radial}, ground`;
  }
  return checkpoint.altitudeFt === undefined
    ? `${radial}, airborne`
    : `${radial}, airborne at ${checkpoint.altitudeFt} ft MSL`;
}

/**
 * Formats the geometry a fix's navaid association publishes: the bearing and
 * distance from the facility when both are published, either one alone when
 * only one is, and the facility type when the FAA publishes neither (as for a
 * fix at a marker beacon).
 */
export function formatFixNavaidAssociation(association: FixNavaidAssociation): string {
  const parts: string[] = [];
  if (association.magneticBearingDeg !== undefined) {
    parts.push(`${association.magneticBearingDeg.toFixed(0)} deg`);
  }
  if (association.distanceNm !== undefined) {
    parts.push(`${association.distanceNm.toFixed(1)} nm`);
  }
  return parts.length > 0 ? parts.join(' / ') : association.navaidType;
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
    case 'SPECIAL':
      return 'Special (non-regulatory)';
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
 * Builds the altitude lines for a waypoint row, one labeled line per
 * altitude the FAA publishes, in the order a pilot reads them: the
 * conventional MEA, the GNSS MEA, the DME/DME/IRU MEA, the MOCA and the
 * MAA for the segment to the next waypoint, then the MCA at the waypoint
 * itself. An altitude that applies to one direction of travel carries
 * the FAA's bound notation, with the opposite direction's value after a
 * slash (`MEA 2100 NE BND / 5000 SW BND`). Returns an empty array when
 * nothing is published, as on an airway's last waypoint.
 */
export function formatAirwayWaypointAltitudes(waypoint: AirwayWaypoint): string[] {
  const labeled: ReadonlyArray<readonly [label: string, value: string | undefined]> = [
    [
      'MEA',
      formatDirectionalAltitude(
        waypoint.minimumEnrouteAltitudeFt,
        waypoint.minimumEnrouteAltitudeDirection,
        waypoint.minimumEnrouteAltitudeOppositeFt,
        waypoint.minimumEnrouteAltitudeOppositeDirection,
      ),
    ],
    [
      'GNSS MEA',
      formatDirectionalAltitude(
        waypoint.gnssMinimumEnrouteAltitudeFt,
        waypoint.gnssMinimumEnrouteAltitudeDirection,
        waypoint.gnssMinimumEnrouteAltitudeOppositeFt,
        waypoint.gnssMinimumEnrouteAltitudeOppositeDirection,
      ),
    ],
    [
      'DME/DME/IRU MEA',
      formatDirectionalAltitude(
        waypoint.dmeDmeIruMinimumEnrouteAltitudeFt,
        waypoint.dmeDmeIruMinimumEnrouteAltitudeDirection,
        undefined,
        undefined,
      ),
    ],
    ['MOCA', waypoint.minimumObstructionClearanceAltitudeFt?.toString()],
    ['MAA', waypoint.maximumAuthorizedAltitudeFt?.toString()],
    [
      'MCA',
      formatDirectionalAltitude(
        waypoint.minimumCrossingAltitudeFt,
        waypoint.minimumCrossingAltitudeDirection,
        waypoint.minimumCrossingAltitudeOppositeFt,
        waypoint.minimumCrossingAltitudeOppositeDirection,
      ),
    ],
  ];
  return labeled.flatMap(([label, value]) => (value === undefined ? [] : [`${label} ${value}`]));
}

/**
 * Joins an altitude and its opposite-direction twin into one value,
 * each with its bound direction when published (`2100 NE BND / 5000 SW
 * BND`), or the bare altitude when it applies both ways. Returns
 * `undefined` when neither altitude is published.
 */
function formatDirectionalAltitude(
  altitudeFt: number | undefined,
  direction: AirwayDirection | undefined,
  oppositeFt: number | undefined,
  oppositeDirection: AirwayDirection | undefined,
): string | undefined {
  const parts: string[] = [];
  if (altitudeFt !== undefined) {
    parts.push(direction === undefined ? `${altitudeFt}` : `${altitudeFt} ${direction}`);
  }
  if (oppositeFt !== undefined) {
    parts.push(
      oppositeDirection === undefined ? `${oppositeFt}` : `${oppositeFt} ${oppositeDirection}`,
    );
  }
  return parts.length === 0 ? undefined : parts.join(' / ');
}
