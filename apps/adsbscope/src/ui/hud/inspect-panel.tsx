import type { ReactElement } from 'react';

import type { ScopeTarget } from '../../shared/protocol.js';

import { ControlButton } from './control-button.js';
import { DESELECT_HOTKEY } from './hotkeys.js';
import { buildInspectContent } from './inspect-panel-content.js';
import styles from './inspect-panel.module.css';

/** Accessible name of the inspect panel. */
export const INSPECT_PANEL_LABEL = 'Selected aircraft';

/** Accessible name of the button that clears the selection. */
export const DESELECT_LABEL = 'Deselect aircraft';

/** Props for {@link InspectPanel}. */
export interface InspectPanelProps {
  /** The selected aircraft, or undefined if nothing is selected or the selected aircraft is no longer tracked. */
  target: ScopeTarget | undefined;
  /** Unix epoch ms of the snapshot the aircraft came from. */
  now: number;
  /** Called when the user asks to clear the selection. */
  onDeselect: () => void;
}

/**
 * The inspect panel: everything known about the selected aircraft, written
 * out in full. It is shown by every view style, only while an aircraft is
 * selected and still being tracked.
 */
export function InspectPanel({ target, now, onDeselect }: InspectPanelProps): ReactElement | null {
  if (target === undefined) {
    return null;
  }
  const { title, rows } = buildInspectContent(target, now);
  return (
    <section className={styles.inspectPanel} aria-label={INSPECT_PANEL_LABEL}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <ControlButton
          label={DESELECT_LABEL}
          shape="square"
          hint={`${DESELECT_HOTKEY} deselects`}
          onPress={onDeselect}
        >
          x
        </ControlButton>
      </div>
      <dl className={styles.rows}>
        {rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <dt className={styles.label}>{row.label}</dt>
            <dd className={styles.value}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
