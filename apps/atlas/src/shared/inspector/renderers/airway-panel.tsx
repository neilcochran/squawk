import type { ReactElement } from 'react';
import type { Airway, AirwayWaypoint } from '@squawk/types';
import { InspectorRow, InspectorSection } from './inspector-row.tsx';

/**
 * Props for {@link AirwayPanel}.
 */
export interface AirwayPanelProps {
  /** The airway record to render. */
  record: Airway;
}

/**
 * Per-type renderer for an `airway` entity. Shows the route classification
 * plus the ordered waypoint list. Each waypoint row carries the segment MEA
 * when the dataset has it (most enroute segments do; some oceanic routes
 * leave it null), so the user can scan the altitude profile at a glance.
 */
export function AirwayPanel({ record }: AirwayPanelProps): ReactElement {
  return (
    <>
      <InspectorSection title="Classification">
        <InspectorRow label="Type">{formatAirwayType(record.type)}</InspectorRow>
        <InspectorRow label="Region">{formatRegion(record.region)}</InspectorRow>
        <InspectorRow label="Waypoints">{record.waypoints.length}</InspectorRow>
      </InspectorSection>
      {record.waypoints.length > 0 ? (
        <InspectorSection title="Route">
          {record.waypoints.map((waypoint, idx) => (
            <InspectorRow
              key={`${waypoint.identifier ?? waypoint.name}-${idx}`}
              label={waypoint.identifier ?? waypoint.name}
            >
              {formatWaypointAltitude(waypoint)}
            </InspectorRow>
          ))}
        </InspectorSection>
      ) : null}
    </>
  );
}

/** Converts the AirwayType discriminator to a sentence-cased label. */
function formatAirwayType(type: Airway['type']): string {
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
function formatRegion(region: Airway['region']): string {
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
 * Builds the right-hand cell for a waypoint row. Prefers `MEA / MAA` when
 * both are present, falls back to MEA alone, then MOCA, then a placeholder
 * em-style hyphen so empty rows still show a visible value column.
 */
function formatWaypointAltitude(waypoint: AirwayWaypoint): string {
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
