import { describe, expect, it, vi } from 'vitest';

import type { ScopeVideoMap } from '../../shared/protocol.js';

import { fetchVideoMap, parseVideoMap, videoMapUrl } from './video-map.js';

const MAP: ScopeVideoMap = {
  rangeNm: 40,
  points: [{ kind: 'airport', label: 'KTST', position: { trueBearingDeg: 10, rangeNm: 5 } }],
  lines: [
    {
      kind: 'runway',
      points: [
        [10, 5],
        [12, 5],
      ],
    },
  ],
};

describe('parseVideoMap', () => {
  it('accepts a map, dropping unknown fields', () => {
    expect(parseVideoMap({ ...MAP, extra: true })).toEqual(MAP);
  });

  it('rejects anything that is not recognizably a map', () => {
    expect(parseVideoMap(null)).toBeUndefined();
    expect(parseVideoMap('map')).toBeUndefined();
    expect(parseVideoMap({ ...MAP, rangeNm: '40' })).toBeUndefined();
    expect(parseVideoMap({ ...MAP, points: undefined })).toBeUndefined();
    expect(parseVideoMap({ ...MAP, lines: {} })).toBeUndefined();
  });
});

describe('videoMapUrl', () => {
  it('asks the map endpoint for the given range', () => {
    expect(videoMapUrl(60)).toBe('/api/videomap?rangeNm=60');
    expect(videoMapUrl(12.5)).toBe('/api/videomap?rangeNm=12.5');
  });
});

describe('fetchVideoMap', () => {
  it('requests the map for the range and returns it parsed', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(Response.json(MAP)));

    await expect(fetchVideoMap(40, fetchImpl)).resolves.toEqual(MAP);
    expect(fetchImpl).toHaveBeenCalledWith('/api/videomap?rangeNm=40');
  });

  it('returns undefined for an error response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('nope', { status: 500 })),
    );

    await expect(fetchVideoMap(40, fetchImpl)).resolves.toBeUndefined();
  });

  it('returns undefined when the request fails, the body is not JSON, or it is not a map', async () => {
    const failing = vi.fn<typeof fetch>(() => Promise.reject(new Error('offline')));
    const notJson = vi.fn<typeof fetch>(() => Promise.resolve(new Response('<html>')));
    const notMap = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ rangeNm: 40 })));

    await expect(fetchVideoMap(40, failing)).resolves.toBeUndefined();
    await expect(fetchVideoMap(40, notJson)).resolves.toBeUndefined();
    await expect(fetchVideoMap(40, notMap)).resolves.toBeUndefined();
  });
});
