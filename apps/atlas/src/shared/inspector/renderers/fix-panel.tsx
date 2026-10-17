import type { ReactElement } from 'react';

import type { Fix } from '@squawk/types';

import { formatFixNavaidAssociation, formatFixUseCode } from '../formatters.ts';

import { InspectorRemarks } from './inspector-remarks.tsx';
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
        <InspectorRow label="Use">{formatFixUseCode(record.useCode)}</InspectorRow>
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
              {formatFixNavaidAssociation(association)}
            </InspectorRow>
          ))}
        </InspectorSection>
      ) : null}
      <InspectorRemarks
        title="Remark"
        remarks={record.chartingRemark !== undefined ? [record.chartingRemark] : []}
      />
    </>
  );
}
