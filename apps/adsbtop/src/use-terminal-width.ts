import { useStdout } from 'ink';
import { useEffect, useState } from 'react';

/** Width assumed when stdout reports none (not a TTY) - the classic 80-column terminal. */
const FALLBACK_TERMINAL_WIDTH = 80;

/**
 * The terminal's current width in columns, re-read whenever stdout emits
 * `resize`, so column auto-fit follows the window as the user resizes it.
 *
 * @returns The current width in terminal columns.
 */
export function useTerminalWidth(): number {
  const { stdout } = useStdout();
  const [width, setWidth] = useState<number>(stdout.columns ?? FALLBACK_TERMINAL_WIDTH);

  useEffect(() => {
    function handleResize(): void {
      setWidth(stdout.columns ?? FALLBACK_TERMINAL_WIDTH);
    }
    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return width;
}
