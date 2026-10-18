import type { ReactElement } from 'react';

import type { Fix } from '@squawk/types';

import { useFixAssociationSelections } from '../fix-association-selection.ts';
import { formatFixNavaidAssociation, formatFixUseCode } from '../formatters.ts';

import { InspectorRemarks } from './inspector-remarks.tsx';
import { InspectorRow, InspectorSection } from './inspector-row.tsx';

/**
 * Props for {@link FixPanel}.
 */
export interface FixPanelProps {
  /** The fix record to render. */
  record: Fix;
  /**
   * Selects another entity by its `selected` value, panning to it first.
   * When set, each association row whose facility is a navaid links to
   * that navaid; without it the rows stay plain text.
   */
  onSelectEntity?: (selection: string) => void;
}

/**
 * Per-type renderer for a `fix` entity. Fixes carry less data per record
 * than airports / navaids, so the panel is compact: classification,
 * location, MRA / compulsory designation if any, and the navaid
 * associations that geographically define the fix. Each association row
 * names the facility with its type (`CPS LOC`, `CPS OM`), since a
 * localizer and its outer marker share an identifier, and gives the
 * magnetic bearing and distance from it where the FAA publishes them.
 * A row whose facility is a navaid links to that navaid; a localizer or
 * marker beacon row stays plain, since those belong to an airport's ILS
 * and have no panel of their own.
 */
export function FixPanel({ record, onSelectEntity }: FixPanelProps): ReactElement {
  const associationSelections = useFixAssociationSelections(record);
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
          {record.navaidAssociations.map((association, idx) => {
            const selection = associationSelections[idx];
            return (
              <InspectorRow
                key={`${association.navaidId}-${idx}`}
                label={`${association.navaidId} ${association.navaidType}`}
                {...(onSelectEntity !== undefined &&
                  selection !== undefined && {
                    onLabelSelect: (): void => onSelectEntity(selection),
                  })}
              >
                {formatFixNavaidAssociation(association)}
              </InspectorRow>
            );
          })}
        </InspectorSection>
      ) : null}
      <InspectorRemarks
        title="Remark"
        remarks={record.chartingRemark !== undefined ? [record.chartingRemark] : []}
      />
    </>
  );
}
