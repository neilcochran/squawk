import { render } from 'ink-testing-library';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FilterBar } from './filter-bar.js';

function flush(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function Harness({ onSubmit }: { onSubmit: (query: string) => void }): ReactElement {
  const [query, setQuery] = useState('');
  return <FilterBar query={query} error={undefined} onChange={setQuery} onSubmit={onSubmit} />;
}

describe('FilterBar', () => {
  it('renders the filter label and the syntax hint', () => {
    const { lastFrame } = render(
      <FilterBar
        query=""
        error={undefined}
        onChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    const frame = lastFrame();
    expect(frame).toContain('Filter:');
    expect(frame).toContain('is:airborne (is:air)');
    expect(frame).toContain('is:emergency (is:emerg)');
    expect(frame).toContain('within:<nm>');
  });

  it('shows the in-progress text', () => {
    const { lastFrame } = render(
      <FilterBar
        query="is:air UAL"
        error={undefined}
        onChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(lastFrame()).toContain('is:air UAL');
  });

  it('replaces the hint with the error when one is set', () => {
    const { lastFrame } = render(
      <FilterBar
        query="is:flying"
        error='Unknown state "flying"'
        onChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    const frame = lastFrame();
    expect(frame).toContain('Unknown state "flying"');
    expect(frame).not.toContain('within:<nm>');
  });

  it('calls onChange as the user types and onSubmit when Enter is pressed', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Harness onSubmit={onSubmit} />);
    await flush();

    stdin.write('is:gnd');
    await flush();
    stdin.write('\r');
    await flush();

    expect(onSubmit).toHaveBeenCalledWith('is:gnd');
  });
});
