import { EventEmitter } from 'node:events';

import { Text, render as inkRender } from 'ink';
import { render } from 'ink-testing-library';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { useTerminalSize } from './use-terminal-size.js';

function SizeProbe(): ReactElement {
  const size = useTerminalSize();
  return (
    <Text>
      columns={size.columns} rows={size.rows === undefined ? 'unknown' : size.rows}
    </Text>
  );
}

/** A stdout fake whose reported dimensions are chosen per test; ink-testing-library's always reports 100 columns and no rows. */
class DimensionedStdout extends EventEmitter {
  private readonly frames: string[] = [];

  constructor(
    readonly columns: number | undefined,
    readonly rows: number | undefined,
  ) {
    super();
  }

  write = (frame: string): boolean => {
    this.frames.push(frame);
    return true;
  };

  /** The last frame with content - unmounting writes a blank one after it. */
  lastContentFrame = (): string => this.frames.filter((frame) => frame.trim() !== '').at(-1) ?? '';
}

function renderWith(stdout: DimensionedStdout): () => string {
  const instance = inkRender(<SizeProbe />, {
    // The fake covers the parts of the stream Ink touches in debug mode.
    stdout: stdout as unknown as NodeJS.WriteStream,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  instance.unmount();
  return stdout.lastContentFrame;
}

describe('useTerminalSize', () => {
  it('falls back to 80 columns and an unknown height when stdout reports neither', () => {
    expect(renderWith(new DimensionedStdout(undefined, undefined))()).toBe(
      'columns=80 rows=unknown',
    );
  });

  it('reports both dimensions when stdout has them', () => {
    expect(renderWith(new DimensionedStdout(132, 43))()).toBe('columns=132 rows=43');
  });

  it('reports the width stdout advertises and an unknown height when it reports none', () => {
    const { lastFrame } = render(<SizeProbe />);
    expect(lastFrame()).toBe('columns=100 rows=unknown');
  });

  it('re-reads the size when stdout emits resize', async () => {
    const { lastFrame, stdout } = render(<SizeProbe />);
    stdout.emit('resize');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(lastFrame()).toBe('columns=100 rows=unknown');
  });
});
