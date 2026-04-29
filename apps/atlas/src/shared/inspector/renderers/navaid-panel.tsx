import type { ReactElement } from 'react';
import type { Navaid } from '@squawk/types';
import {
  formatNavaidFrequency,
  formatNavaidMagVariation,
  formatNavaidStatus,
} from '../formatters.ts';
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
 * TACAN channel), location, status, and magnetic-variation data. The
 * frequency row picks MHz vs kHz based on which one the dataset populated
 * for this navaid type (VOR family uses MHz, NDB family uses kHz).
 */
export function NavaidPanel({ record }: NavaidPanelProps): ReactElement {
  return (
    <>
      <InspectorSection title="Tuning">
        <InspectorRow label="Frequency">{formatNavaidFrequency(record)}</InspectorRow>
        <InspectorRow label="TACAN ch">{record.tacanChannel ?? null}</InspectorRow>
        <InspectorRow label="Status">{formatNavaidStatus(record.status)}</InspectorRow>
        <InspectorRow label="Class">{record.navaidClass ?? null}</InspectorRow>
      </InspectorSection>
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
    </>
  );
}
