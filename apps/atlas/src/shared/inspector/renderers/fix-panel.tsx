import type { ReactElement } from 'react';
import type { Fix } from '@squawk/types';
import { InspectorRow, InspectorSection } from './inspector-row.tsx';

/**
 * Props for {@link FixPanel}.
 */
export interface FixPanelProps {
  /** The fix record to render. */
  record: Fix;
}

/**
 * Per-type renderer for a `fix` entity. Fixes carry less data per record
 * than airports / navaids, so the panel is compact: classification,
 * location, MRA / compulsory designation if any, and the navaid
 * associations that geographically define the fix.
 */
export function FixPanel({ record }: FixPanelProps): ReactElement {
  return (
    <>
      <InspectorSection title="Classification">
        <InspectorRow label="Use">{formatUseCode(record.useCode)}</InspectorRow>
        <InspectorRow label="Compulsory">{record.compulsory ?? null}</InspectorRow>
        <InspectorRow label="MRA">
          {record.minimumReceptionAltitudeFt !== undefined
            ? `${record.minimumReceptionAltitudeFt} ft`
            : null}
        </InspectorRow>
        <InspectorRow label="Charts">
          {record.chartTypes.length === 0 ? null : record.chartTypes.join(', ')}
        </InspectorRow>
      </InspectorSection>
      <InspectorSection title="Location">
        <InspectorRow label="State">{record.state ?? null}</InspectorRow>
        <InspectorRow label="Country">{record.country}</InspectorRow>
        <InspectorRow label="ARTCC (low)">{record.lowArtccId ?? null}</InspectorRow>
        <InspectorRow label="ARTCC (high)">{record.highArtccId ?? null}</InspectorRow>
      </InspectorSection>
      {record.navaidAssociations.length > 0 ? (
        <InspectorSection title={`Navaid associations (${record.navaidAssociations.length})`}>
          {record.navaidAssociations.map((association, idx) => (
            <InspectorRow key={`${association.navaidId}-${idx}`} label={association.navaidId}>
              {`${association.bearingDeg.toFixed(0)} deg / ${association.distanceNm.toFixed(1)} nm`}
            </InspectorRow>
          ))}
        </InspectorSection>
      ) : null}
      {record.chartingRemark !== undefined ? (
        <InspectorSection title="Remark">
          <p className="text-sm text-slate-700 dark:text-slate-300">{record.chartingRemark}</p>
        </InspectorSection>
      ) : null}
    </>
  );
}

/** Converts the FixUseCode discriminator to a sentence-cased label. */
function formatUseCode(use: Fix['useCode']): string {
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
