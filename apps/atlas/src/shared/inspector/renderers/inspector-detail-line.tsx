import type { ReactElement, ReactNode } from 'react';

/**
 * Props for {@link InspectorDetailLine}.
 */
export interface InspectorDetailLineProps {
  /** The secondary text, such as a remark, a description or a sectorization. */
  children: ReactNode;
}

/**
 * A muted secondary line stacked under the main value of an inspector row:
 * an airway waypoint's remark, a VOR checkpoint's description, a runway's
 * pavement rating or a frequency's sectorization.
 */
export function InspectorDetailLine({ children }: InspectorDetailLineProps): ReactElement {
  return <span className="block text-xs text-slate-500 dark:text-slate-400">{children}</span>;
}
