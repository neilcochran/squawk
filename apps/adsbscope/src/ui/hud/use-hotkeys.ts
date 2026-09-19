import { useEffect } from 'react';

import type { KeyPress } from './hotkeys.js';

/**
 * Listens for key presses for as long as the component is mounted. Presses
 * aimed at a text field are left alone, so typing in an input can never
 * trigger a hotkey.
 *
 * @param onKeyPress - Called with each key press. Should be stable across renders, or the listener is re-attached each time.
 */
export function useHotkeys(onKeyPress: (press: KeyPress) => void): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      onKeyPress({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
      });
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onKeyPress]);
}
