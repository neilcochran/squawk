import type { ReactElement } from 'react';

import { InspectorSection } from './inspector-row.tsx';

/**
 * Props for {@link InspectorRemarks}.
 */
export interface InspectorRemarksProps {
  /** Section heading (e.g. "Remarks"). */
  title: string;
  /** The FAA's remark text, one paragraph per entry, in published order. */
  remarks: readonly string[];
}

/**
 * An inspector section of free-text FAA remarks, one paragraph per remark.
 * Renders nothing when there are no remarks, so a panel can pass a record's
 * optional remarks straight through.
 */
export function InspectorRemarks({ title, remarks }: InspectorRemarksProps): ReactElement | null {
  if (remarks.length === 0) {
    return null;
  }
  return (
    <InspectorSection title={title}>
      {remarks.map((remark, idx) => (
        <p key={idx} className="py-1 text-sm text-slate-700 dark:text-slate-300">
          {remark}
        </p>
      ))}
    </InspectorSection>
  );
}
