import { describe, expect, it, vi } from 'vitest';

import type { VideoMapSourceData } from './build.js';
import { createVideoMapProvider, DEFAULT_MAX_CACHED_MAPS } from './provider.js';
import { makeAirport } from './test-utils.js';

const RECEIVER = { lat: 40, lon: -74 };
const DATA: VideoMapSourceData = {
  airports: [makeAirport({ icao: 'KTST', towerType: 'ATCT' })],
  navaids: [],
  fixes: [],
  airspace: [],
};

describe('createVideoMapProvider', () => {
  it('builds the map for the requested range around the receiver', async () => {
    const provider = createVideoMapProvider({
      receiver: RECEIVER,
      loadData: () => Promise.resolve(DATA),
    });

    const map = await provider.get(40);

    expect(map.rangeNm).toBe(40);
    expect(map.points.map((point) => point.label)).toEqual(['KTST']);
  });

  it('loads the source records once, however many maps are asked for', async () => {
    const loadData = vi.fn(() => Promise.resolve(DATA));
    const provider = createVideoMapProvider({ receiver: RECEIVER, loadData });

    await Promise.all([provider.get(20), provider.get(40), provider.preload()]);
    await provider.get(60);

    expect(loadData).toHaveBeenCalledTimes(1);
  });

  it('does not load anything until it is asked to', () => {
    const loadData = vi.fn(() => Promise.resolve(DATA));

    createVideoMapProvider({ receiver: RECEIVER, loadData });

    expect(loadData).not.toHaveBeenCalled();
  });

  it('preloads the source records so the first map does not wait for them', async () => {
    const loadData = vi.fn(() => Promise.resolve(DATA));
    const provider = createVideoMapProvider({ receiver: RECEIVER, loadData });

    await provider.preload();

    expect(loadData).toHaveBeenCalledTimes(1);
  });

  it('keeps a built map, returning the same one for the same range', async () => {
    const provider = createVideoMapProvider({
      receiver: RECEIVER,
      loadData: () => Promise.resolve(DATA),
    });

    expect(await provider.get(40)).toBe(await provider.get(40));
    expect(await provider.get(40)).not.toBe(await provider.get(60));
  });

  it('bounds the cache, dropping the least recently requested map first', async () => {
    const provider = createVideoMapProvider({
      receiver: RECEIVER,
      loadData: () => Promise.resolve(DATA),
      maxCachedMaps: 2,
    });
    const first = await provider.get(10);
    const second = await provider.get(20);
    await provider.get(10);

    await provider.get(30);

    expect(await provider.get(10)).toBe(first);
    expect(await provider.get(20)).not.toBe(second);
  });

  it('keeps a generous number of maps by default', async () => {
    const provider = createVideoMapProvider({
      receiver: RECEIVER,
      loadData: () => Promise.resolve(DATA),
    });
    const first = await provider.get(1);
    const second = await provider.get(2);

    for (let rangeNm = 3; rangeNm <= DEFAULT_MAX_CACHED_MAPS; rangeNm++) {
      await provider.get(rangeNm);
    }
    expect(await provider.get(1)).toBe(first);

    await provider.get(DEFAULT_MAX_CACHED_MAPS + 1);
    expect(await provider.get(2)).not.toBe(second);
  });

  it('does not remember a failed load, so the next request tries again', async () => {
    const loadData = vi
      .fn<() => Promise<VideoMapSourceData>>()
      .mockRejectedValueOnce(new Error('snapshot unreadable'))
      .mockResolvedValue(DATA);
    const provider = createVideoMapProvider({ receiver: RECEIVER, loadData });

    await expect(provider.get(40)).rejects.toThrow('snapshot unreadable');
    await expect(provider.get(40)).resolves.toMatchObject({ rangeNm: 40 });
    expect(loadData).toHaveBeenCalledTimes(2);
  });
});
