import { useStdout } from 'ink';
import { useEffect, useState } from 'react';

/** Width assumed when stdout reports none (not a TTY) - the classic 80-column terminal. */
const FALLBACK_TERMINAL_COLUMNS = 80;

/** The terminal's current dimensions. */
export interface TerminalSize {
  /** Width in columns. */
  columns: number;
  /** Height in rows, or undefined when stdout does not report one (not a TTY, or a test harness) - callers then skip row windowing. */
  rows: number | undefined;
}

function readSize(stdout: NodeJS.WriteStream): TerminalSize {
  return {
    columns: typeof stdout.columns === 'number' ? stdout.columns : FALLBACK_TERMINAL_COLUMNS,
    rows: typeof stdout.rows === 'number' ? stdout.rows : undefined,
  };
}

/**
 * The terminal's current size, re-read whenever stdout emits `resize`, so
 * column auto-fit and row windowing follow the window as the user resizes
 * it. Width always has a value; height is undefined when the stream does
 * not report one, which tells callers that windowing has no basis and
 * should be skipped rather than guessed.
 *
 * @returns The current size.
 */
export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>(() => readSize(stdout));

  useEffect(() => {
    function handleResize(): void {
      setSize(readSize(stdout));
    }
    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return size;
}
