// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScopeConfig } from '../shared/protocol.js';

import { App } from './app.js';
import { FakeEventSource } from './test-utils.js';

const CONFIG: ScopeConfig = {
  receiver: { lat: 40.6413, lon: -73.7781 },
  source: 'beast',
  station: '192.168.1.50:30005',
  mode: 'digital',
  rangeNm: 60,
};

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('style');
});

describe('App', () => {
  it('shows a loading status until the config arrives', () => {
    const loadConfig = (): Promise<ScopeConfig> => new Promise(() => undefined);

    render(<App loadConfig={loadConfig} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading scope...');
    expect(screen.queryByLabelText('Radar scope')).not.toBeInTheDocument();
  });

  it('shows an alert when the config cannot be loaded', async () => {
    const loadConfig = (): Promise<undefined> => Promise.resolve(undefined);

    render(<App loadConfig={loadConfig} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the scope configuration',
    );
  });

  it('shows the scope at the configured range once the config has loaded', async () => {
    const loadConfig = (): Promise<ScopeConfig> => Promise.resolve(CONFIG);

    render(<App loadConfig={loadConfig} />);

    expect(await screen.findByLabelText('Radar scope')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('beast 192.168.1.50:30005');
    expect(screen.getByRole('status')).toHaveTextContent('range 60 nm');
  });
});
