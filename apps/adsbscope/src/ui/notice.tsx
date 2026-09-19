import type { ReactElement, ReactNode } from 'react';

import styles from './notice.module.css';

/** Props for {@link Notice}. */
export interface NoticeProps {
  /** Whether the notice reports a problem, which is announced more assertively than a routine status. */
  kind: 'status' | 'alert';
  /** The message. */
  children: ReactNode;
}

/** A full-page message shown in place of the scope, while it loads or when it cannot. */
export function Notice({ kind, children }: NoticeProps): ReactElement {
  return (
    <div className={styles.notice} role={kind}>
      {children}
    </div>
  );
}
