// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ScopeConfig } from '../../shared/protocol.js';

import { useScopeConfig } from './use-scope-config.js';

const CONFIG: ScopeConfig = {
  receiver: { lat: 40.6413, lon: -73.7781 },
  source: 'beast',
  station: '192.168.1.50:30005',
  mode: 'digital',
  rangeNm: 60,
};

describe('useScopeConfig', () => {
  it('is loading until the config arrives, then loaded with it', async () => {
    const loadConfig = vi.fn(() => Promise.resolve(CONFIG));

    const { result } = renderHook(() => useScopeConfig(loadConfig));

    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current).toEqual({ status: 'loaded', config: CONFIG }));
    expect(loadConfig).toHaveBeenCalledTimes(1);
  });

  it('reports an error when no usable config comes back', async () => {
    const loadConfig = (): Promise<undefined> => Promise.resolve(undefined);

    const { result } = renderHook(() => useScopeConfig(loadConfig));

    await waitFor(() => expect(result.current).toEqual({ status: 'error' }));
  });

  it('ignores a config that arrives after unmount', async () => {
    let resolveConfig: (config: ScopeConfig) => void = () => undefined;
    const pending = new Promise<ScopeConfig>((resolve) => {
      resolveConfig = resolve;
    });
    const { result, unmount } = renderHook(() => useScopeConfig(() => pending));

    unmount();
    resolveConfig(CONFIG);
    await pending;

    expect(result.current).toEqual({ status: 'loading' });
  });
});
