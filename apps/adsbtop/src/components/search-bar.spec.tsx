import { render } from 'ink-testing-library';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SearchBar } from './search-bar.js';

function flush(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function Harness({ onSubmit }: { onSubmit: (query: string) => void }): ReactElement {
  const [query, setQuery] = useState('');
  return <SearchBar query={query} onChange={setQuery} onSubmit={onSubmit} />;
}

describe('SearchBar', () => {
  it('renders the search label', () => {
    const { lastFrame } = render(
      <SearchBar query="" onChange={() => undefined} onSubmit={() => undefined} />,
    );
    expect(lastFrame()).toContain('Search:');
  });

  it('shows the in-progress query text', () => {
    const { lastFrame } = render(
      <SearchBar query="UAL" onChange={() => undefined} onSubmit={() => undefined} />,
    );
    expect(lastFrame()).toContain('UAL');
  });

  it('calls onChange as the user types and onSubmit when Enter is pressed', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Harness onSubmit={onSubmit} />);
    await flush();

    stdin.write('UAL123');
    await flush();
    stdin.write('\r');
    await flush();

    expect(onSubmit).toHaveBeenCalledWith('UAL123');
  });
});
