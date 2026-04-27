import type { ReactElement } from 'react';
import type { Airport } from '@squawk/types';
import { InspectorRow, InspectorSection } from './inspector-row.tsx';

/**
 * Props for {@link AirportPanel}.
 */
export interface AirportPanelProps {
  /** The airport record to render. */
  record: Airport;
}

/**
 * Per-type renderer for an `airport` entity. Shows location, identification,
 * physical characteristics, runways, and frequencies. The runway and
 * frequency sections render only when the record actually has entries so
 * the panel stays compact for small private fields.
 */
export function AirportPanel({ record }: AirportPanelProps): ReactElement {
  return (
    <>
      <InspectorSection title="Location">
        <InspectorRow label="City">{record.city}</InspectorRow>
        <InspectorRow label="State">{record.state}</InspectorRow>
        <InspectorRow label="Country">{record.country}</InspectorRow>
        <InspectorRow label="Elevation">
          {record.elevationFt !== undefined ? `${record.elevationFt} ft MSL` : null}
        </InspectorRow>
        <InspectorRow label="Time zone">{record.timezone}</InspectorRow>
      </InspectorSection>
      <InspectorSection title="Facility">
        <InspectorRow label="Type">{formatFacilityType(record.facilityType)}</InspectorRow>
        <InspectorRow label="Status">{formatStatus(record.status)}</InspectorRow>
        <InspectorRow label="Use">
          {record.useType === 'PUBLIC' ? 'Public' : 'Private'}
        </InspectorRow>
        <InspectorRow label="Tower">{record.towerType ?? null}</InspectorRow>
        <InspectorRow label="ARTCC">{record.artccId ?? null}</InspectorRow>
        <InspectorRow label="Sectional">{record.sectionChart ?? null}</InspectorRow>
      </InspectorSection>
      {record.runways.length > 0 ? (
        <InspectorSection title={`Runways (${record.runways.length})`}>
          {record.runways.map((runway) => (
            <InspectorRow key={runway.id} label={runway.id}>
              {formatRunway(runway.lengthFt, runway.widthFt, runway.surfaceType)}
            </InspectorRow>
          ))}
        </InspectorSection>
      ) : null}
      {record.frequencies.length > 0 ? (
        <InspectorSection title={`Frequencies (${record.frequencies.length})`}>
          {record.frequencies.map((frequency, idx) => (
            <InspectorRow key={`${frequency.use}-${idx}`} label={frequency.use}>
              {`${frequency.frequencyMhz.toFixed(2)} MHz`}
            </InspectorRow>
          ))}
        </InspectorSection>
      ) : null}
    </>
  );
}

/** Converts the FacilityType discriminator to a sentence-cased label. */
function formatFacilityType(type: Airport['facilityType']): string {
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
function formatStatus(status: Airport['status']): string {
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
 * skipping any field that is undefined in the source record.
 */
function formatRunway(
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
