import type { ReactElement } from 'react';

import type { ScopeSnapshot } from '../../shared/protocol.js';

import { buildTabList } from './tab-list-content.js';
import styles from './tab-list.module.css';

/** Accessible name of the tab list, and its visible heading. */
export const TAB_LIST_LABEL = 'No position';

/** Props for {@link TabList}. */
export interface TabListProps {
  /** The most recent snapshot, or undefined before the first one arrives. */
  snapshot: ScopeSnapshot | undefined;
}

/**
 * The tab list: aircraft that are being heard from but have not sent a
 * position, so they cannot be plotted. It is shown by every view style, and
 * only while there is something in it.
 */
export function TabList({ snapshot }: TabListProps): ReactElement | null {
  const { rows, hiddenCount } = buildTabList(snapshot);
  if (rows.length === 0) {
    return null;
  }
  return (
    <section className={styles.tabList} aria-label={TAB_LIST_LABEL}>
      <h2 className={styles.heading}>{TAB_LIST_LABEL}</h2>
      <ul className={styles.rows}>
        {rows.map((row) => (
          <li key={row.icaoHex} className={styles.row}>
            <span>{row.identity}</span>
            <span>{row.detail}</span>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && <p className={styles.more}>+{hiddenCount} more</p>}
    </section>
  );
}
