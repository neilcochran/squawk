import type { ReactElement } from 'react';

import { canStepRange } from '../scope/range.js';
import type { RangeDirection } from '../scope/range.js';

import styles from './range-controls.module.css';

/** Props for {@link RangeControls}. */
export interface RangeControlsProps {
  /** The current scope range in nautical miles, which decides whether each button can still step. */
  rangeNm: number;
  /** Called with the direction to step when a button is pressed. */
  onStep: (direction: RangeDirection) => void;
}

/**
 * On-screen zoom buttons, so the range can be changed without a keyboard.
 * Each button is a full-size touch target on small screens and compact on
 * larger ones, and disables itself at the end of the range steps.
 */
export function RangeControls({ rangeNm, onStep }: RangeControlsProps): ReactElement {
  return (
    <div className={styles.rangeControls} role="group" aria-label="Scope range">
      <button
        type="button"
        className={styles.button}
        aria-label="Zoom in"
        disabled={!canStepRange(rangeNm, 'in')}
        onClick={() => onStep('in')}
      >
        +
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label="Zoom out"
        disabled={!canStepRange(rangeNm, 'out')}
        onClick={() => onStep('out')}
      >
        -
      </button>
    </div>
  );
}
