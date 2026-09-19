import { useEffect } from 'react';

import type { RangeDirection } from '../scope/range.js';

import { rangeKeyDirection } from './range-keys.js';

/**
 * Steps the scope range from the keyboard for as long as the component is
 * mounted. Key presses aimed at a form control are left alone, so typing in
 * a future input can never zoom the scope.
 *
 * @param onStep - Called with the direction to step. Should be stable across renders, or the listener is re-attached each time.
 */
export function useRangeKeys(onStep: (direction: RangeDirection) => void): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      const direction = rangeKeyDirection(event.key);
      if (direction !== undefined) {
        onStep(direction);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onStep]);
}
