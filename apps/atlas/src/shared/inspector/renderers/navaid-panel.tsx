import type { ReactElement } from 'react';

import type { Navaid } from '@squawk/types';

import {
  formatNavaidCheckpoint,
  formatNavaidFrequency,
  formatNavaidMagVariation,
  formatNavaidStatus,
} from '../formatters.ts';

import { InspectorDetailLine } from './inspector-detail-line.tsx';
import { InspectorRemarks } from './inspector-remarks.tsx';
import { InspectorRow, InspectorSection } from './inspector-row.tsx';

/**
 * Props for {@link NavaidPanel}.
 */
export interface NavaidPanelProps {
  /** The navaid record to render. */
  record: Navaid;
}

/**
 * Per-type renderer for a `navaid` entity. Shows tuning info (frequency or
 * TACAN channel), status, the FAA's remarks, location, magnetic-variation
 * data, and any VOR receiver checkpoints. The frequency row picks MHz vs kHz
 * based on which one the dataset populated for this navaid type (VOR family
 * uses MHz, NDB family uses kHz). The DME component's own status sits under
 * the facility status where the FAA publishes it, and the remarks follow the
 * tuning section because most of them explain a restricted status: the
 * radials, distances and altitudes where the signal is unusable.
 */
export function NavaidPanel({ record }: NavaidPanelProps): ReactElement {
  const checkpoints = record.checkpoints ?? [];
  return (
    <>
      <InspectorSection title="Tuning">
        <InspectorRow label="Frequency">{formatNavaidFrequency(record)}</InspectorRow>
        <InspectorRow label="TACAN ch">{record.tacanChannel ?? null}</InspectorRow>
        <InspectorRow label="Status">{formatNavaidStatus(record.status)}</InspectorRow>
        <InspectorRow label="DME status">
          {record.dmeStatus !== undefined ? formatNavaidStatus(record.dmeStatus) : null}
        </InspectorRow>
        <InspectorRow label="Class">{record.navaidClass ?? null}</InspectorRow>
      </InspectorSection>
      <InspectorRemarks title="Remarks" remarks={record.remarks ?? []} />
      <InspectorSection title="Location">
        <InspectorRow label="City">{record.city ?? null}</InspectorRow>
        <InspectorRow label="State">{record.state ?? null}</InspectorRow>
        <InspectorRow label="Country">{record.country}</InspectorRow>
        <InspectorRow label="Elevation">
          {record.elevationFt !== undefined ? `${record.elevationFt} ft MSL` : null}
        </InspectorRow>
      </InspectorSection>
      <InspectorSection title="Service">
        <InspectorRow label="ARTCC (low)">{record.lowArtccId ?? null}</InspectorRow>
        <InspectorRow label="ARTCC (high)">{record.highArtccId ?? null}</InspectorRow>
        <InspectorRow label="Mag variation">{formatNavaidMagVariation(record)}</InspectorRow>
        <InspectorRow label="Hours">{record.operatingHours ?? null}</InspectorRow>
      </InspectorSection>
      {checkpoints.length > 0 ? (
        <InspectorSection title={`VOR checkpoints (${checkpoints.length})`}>
          {checkpoints.map((checkpoint, idx) => (
            <InspectorRow
              key={idx}
              label={checkpoint.airportId ?? (checkpoint.type === 'GROUND' ? 'Ground' : 'Airborne')}
            >
              <span className="block tabular-nums">{formatNavaidCheckpoint(checkpoint)}</span>
              <InspectorDetailLine>{checkpoint.description}</InspectorDetailLine>
            </InspectorRow>
          ))}
        </InspectorSection>
      ) : null}
    </>
  );
}
