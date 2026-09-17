import { Text } from 'ink';
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

describe('useTerminalSize', () => {
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
