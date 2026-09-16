import { Text } from 'ink';
import { render } from 'ink-testing-library';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { useTerminalWidth } from './use-terminal-width.js';

function WidthProbe(): ReactElement {
  const width = useTerminalWidth();
  return <Text>width={width}</Text>;
}

describe('useTerminalWidth', () => {
  it('reports the width stdout advertises', () => {
    const { lastFrame } = render(<WidthProbe />);
    expect(lastFrame()).toBe('width=100');
  });

  it('re-reads the width when stdout emits resize', async () => {
    const { lastFrame, stdout } = render(<WidthProbe />);
    stdout.emit('resize');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(lastFrame()).toBe('width=100');
  });
});
