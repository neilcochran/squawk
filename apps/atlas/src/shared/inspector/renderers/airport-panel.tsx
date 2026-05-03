import type { ReactElement } from 'react';

import type { Airport } from '@squawk/types';

import {
  formatAirportFacilityType,
  formatAirportRunway,
  formatAirportStatus,
} from '../formatters.ts';

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
        <InspectorRow label="Type">{formatAirportFacilityType(record.facilityType)}</InspectorRow>
        <InspectorRow label="Status">{formatAirportStatus(record.status)}</InspectorRow>
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
              {formatAirportRunway(runway.lengthFt, runway.widthFt, runway.surfaceType)}
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
