import type { ReactElement } from 'react';

import { APP_NAME } from '../../shared/protocol.js';
import type { PolarPoint, ScopeConfig, ScopeSnapshot } from '../../shared/protocol.js';
import type { StreamState } from '../data/use-scope-stream.js';

import {
  formatTargetCount,
  isLinkHealthy,
  LINK_STATUS_LABELS,
  resolveLinkStatus,
} from './link-status.js';
import { formatPolarPosition } from './position-format.js';
import styles from './status-bar.module.css';

/** Props for {@link StatusBar}. */
export interface StatusBarProps {
  /** The session config. */
  config: ScopeConfig;
  /** The state of the browser's link to the scope server. */
  streamState: StreamState;
  /** The most recent snapshot, or undefined before the first one arrives. */
  snapshot: ScopeSnapshot | undefined;
  /** The current scope range in nautical miles. */
  rangeNm: number;
  /** Where the pointer is over the scope, relative to the receiver, or undefined while it is off the scope or there is no pointer. */
  cursor: PolarPoint | undefined;
}

/**
 * The readout in the corner of the scope: source, link health, target counts,
 * and range, followed by the bearing and range under the pointer while there
 * is one. The pointer line sits outside the live region, since it changes
 * with every movement of the mouse and is only of use to whoever is moving
 * it.
 */
export function StatusBar({
  config,
  streamState,
  snapshot,
  rangeNm,
  cursor,
}: StatusBarProps): ReactElement {
  const status = resolveLinkStatus(streamState, snapshot);
  return (
    <div className={styles.statusBar}>
      <div className={styles.readout} role="status">
        <span className={styles.name}>{APP_NAME}</span>
        <span>
          {config.source} {config.station}
        </span>
        <span className={isLinkHealthy(status) ? styles.statusOk : styles.statusAlert}>
          {LINK_STATUS_LABELS[status]}
        </span>
        <span>{formatTargetCount(snapshot)}</span>
        <span>range {rangeNm} nm</span>
      </div>
      {cursor !== undefined && <span>cursor {formatPolarPosition(cursor)}</span>}
    </div>
  );
}
