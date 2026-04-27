import type { ReactElement } from 'react';
import type { Navaid } from '@squawk/types';
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
        <InspectorRow label="Frequency">{formatFrequency(record)}</InspectorRow>
        <InspectorRow label="TACAN ch">{record.tacanChannel ?? null}</InspectorRow>
        <InspectorRow label="Status">{formatStatus(record.status)}</InspectorRow>
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
        <InspectorRow label="Mag variation">{formatMagVariation(record)}</InspectorRow>
        <InspectorRow label="Hours">{record.operatingHours ?? null}</InspectorRow>
      </InspectorSection>
    </>
  );
}

/**
 * Formats the navaid frequency in the unit the dataset populated. VOR-family
 * stations have `frequencyMhz`; NDB-family stations have `frequencyKhz`. A
 * navaid carries at most one of these; if neither is set, returns null so
 * the row hides.
 */
function formatFrequency(record: Navaid): string | null {
  if (record.frequencyMhz !== undefined) {
    return `${record.frequencyMhz.toFixed(2)} MHz`;
  }
  if (record.frequencyKhz !== undefined) {
    return `${record.frequencyKhz} kHz`;
  }
  return null;
}

/** Renders the magnetic variation as `{deg} {direction}` or null. */
function formatMagVariation(record: Navaid): string | null {
  if (record.magneticVariationDeg === undefined) {
    return null;
  }
  const direction = record.magneticVariationDirection;
  return direction === undefined
    ? `${record.magneticVariationDeg} deg`
    : `${record.magneticVariationDeg} deg ${direction}`;
}

/** Converts the NavaidStatus discriminator to a sentence-cased label. */
function formatStatus(status: Navaid['status']): string {
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
