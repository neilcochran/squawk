import type { ReactElement } from 'react';

import { canStepRange } from '../scope/range.js';
import type { RangeDirection } from '../scope/range.js';

import { ControlButton } from './control-button.js';
import styles from './control-group.module.css';

/** Props for {@link RangeControls}. */
export interface RangeControlsProps {
  /** The current scope range in nautical miles, which decides whether each button can still step. */
  rangeNm: number;
  /** Called with the direction to step when a button is pressed. */
  onStep: (direction: RangeDirection) => void;
}

/**
 * On-screen zoom buttons, so the range can be changed without a keyboard.
 * Each button disables itself at the end of the range steps.
 */
export function RangeControls({ rangeNm, onStep }: RangeControlsProps): ReactElement {
  return (
    <div className={styles.bottomRight} role="group" aria-label="Scope range">
      <ControlButton
        label="Zoom in"
        shape="square"
        hint="Zoom in (+)"
        disabled={!canStepRange(rangeNm, 'in')}
        onPress={() => onStep('in')}
      >
        +
      </ControlButton>
      <ControlButton
        label="Zoom out"
        shape="square"
        hint="Zoom out (-)"
        disabled={!canStepRange(rangeNm, 'out')}
        onPress={() => onStep('out')}
      >
        -
      </ControlButton>
    </div>
  );
}
