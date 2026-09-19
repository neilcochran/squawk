import { describe, expect, it, vi } from 'vitest';

import type { ScopeConfig } from '../../shared/protocol.js';

import { fetchScopeConfig, parseScopeConfig } from './scope-config.js';

const CONFIG: ScopeConfig = {
  receiver: { lat: 40.6413, lon: -73.7781 },
  source: 'beast',
  station: '192.168.1.50:30005',
  rangeNm: 60,
};

describe('parseScopeConfig', () => {
  it('accepts a complete config for every source', () => {
    expect(parseScopeConfig(CONFIG)).toEqual(CONFIG);
    for (const source of ['json', 'sbs', 'replay'] as const) {
      expect(parseScopeConfig({ ...CONFIG, source })).toEqual({ ...CONFIG, source });
    }
  });

  it('drops unknown fields', () => {
    expect(parseScopeConfig({ ...CONFIG, extra: true })).toEqual(CONFIG);
  });

  it('rejects anything that is not a usable config', () => {
    expect(parseScopeConfig(null)).toBeUndefined();
    expect(parseScopeConfig('config')).toBeUndefined();
    expect(parseScopeConfig({ ...CONFIG, receiver: undefined })).toBeUndefined();
    expect(parseScopeConfig({ ...CONFIG, receiver: { lat: '40', lon: -73 } })).toBeUndefined();
    expect(parseScopeConfig({ ...CONFIG, receiver: { lat: 40 } })).toBeUndefined();
    expect(parseScopeConfig({ ...CONFIG, source: 'radar' })).toBeUndefined();
    expect(parseScopeConfig({ ...CONFIG, station: 5 })).toBeUndefined();
    expect(parseScopeConfig({ ...CONFIG, rangeNm: '60' })).toBeUndefined();
    expect(parseScopeConfig({ ...CONFIG, rangeNm: 0 })).toBeUndefined();
    expect(parseScopeConfig({ ...CONFIG, rangeNm: Number.NaN })).toBeUndefined();
  });
});

describe('fetchScopeConfig', () => {
  it('requests the config endpoint and returns the parsed config', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(Response.json(CONFIG)));

    await expect(fetchScopeConfig(fetchImpl)).resolves.toEqual(CONFIG);
    expect(fetchImpl).toHaveBeenCalledWith('/api/config');
  });

  it('returns undefined for an error response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('nope', { status: 500 })),
    );

    await expect(fetchScopeConfig(fetchImpl)).resolves.toBeUndefined();
  });

  it('returns undefined when the request fails or the body is not JSON', async () => {
    const failing = vi.fn<typeof fetch>(() => Promise.reject(new Error('offline')));
    const notJson = vi.fn<typeof fetch>(() => Promise.resolve(new Response('<html>')));

    await expect(fetchScopeConfig(failing)).resolves.toBeUndefined();
    await expect(fetchScopeConfig(notJson)).resolves.toBeUndefined();
  });

  it('returns undefined for a body that is not a usable config', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ rangeNm: 60 })));

    await expect(fetchScopeConfig(fetchImpl)).resolves.toBeUndefined();
  });
});
