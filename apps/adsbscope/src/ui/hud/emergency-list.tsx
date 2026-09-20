import type { ReactElement } from 'react';

import type { ScopeSnapshot } from '../../shared/protocol.js';

import { buildEmergencyList } from './emergency-list-content.js';
import styles from './emergency-list.module.css';

/** Accessible name of the emergency list, and its visible heading. */
export const EMERGENCY_LIST_LABEL = 'Emergency';

/** Props for {@link EmergencyList}. */
export interface EmergencyListProps {
  /** The most recent snapshot, or undefined before the first one arrives. */
  snapshot: ScopeSnapshot | undefined;
}

/**
 * The emergency list: every aircraft in an emergency, named where it cannot
 * be missed even if the aircraft itself is off the scope. It is an alert
 * region, so assistive technology announces an emergency as it appears, and
 * it is shown by every view style, only while there is something in it.
 */
export function EmergencyList({ snapshot }: EmergencyListProps): ReactElement | null {
  const rows = buildEmergencyList(snapshot);
  if (rows.length === 0) {
    return null;
  }
  return (
    <section className={styles.emergencyList} role="alert" aria-label={EMERGENCY_LIST_LABEL}>
      <h2 className={styles.heading}>{EMERGENCY_LIST_LABEL}</h2>
      <ul className={styles.rows}>
        {rows.map((row) => (
          <li key={row.icaoHex} className={styles.row}>
            <span>{row.identity}</span>
            {row.squawk !== undefined && <span>{row.squawk}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
