// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ScopeVideoMap } from '../../shared/protocol.js';

import { useVideoMap } from './use-video-map.js';

function mapFor(rangeNm: number): ScopeVideoMap {
  return { rangeNm, points: [], lines: [] };
}

describe('useVideoMap', () => {
  it('has no map until the first one loads, then returns it', async () => {
    const loadVideoMap = vi.fn((rangeNm: number) => Promise.resolve(mapFor(rangeNm)));

    const { result } = renderHook(() => useVideoMap(60, loadVideoMap));

    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toEqual(mapFor(60)));
    expect(loadVideoMap).toHaveBeenCalledTimes(1);
  });

  it('loads the map for a new range, keeping the old map until the new one arrives', async () => {
    let releaseNext: (map: ScopeVideoMap) => void = () => undefined;
    const loadVideoMap = vi
      .fn<(rangeNm: number) => Promise<ScopeVideoMap | undefined>>()
      .mockResolvedValueOnce(mapFor(60))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseNext = resolve;
          }),
      );
    const { result, rerender } = renderHook(({ rangeNm }) => useVideoMap(rangeNm, loadVideoMap), {
      initialProps: { rangeNm: 60 },
    });
    await waitFor(() => expect(result.current).toEqual(mapFor(60)));

    rerender({ rangeNm: 40 });

    expect(loadVideoMap).toHaveBeenLastCalledWith(40);
    expect(result.current).toEqual(mapFor(60));
    await act(async () => {
      releaseNext(mapFor(40));
      await Promise.resolve();
    });
    expect(result.current).toEqual(mapFor(40));
  });

  it('keeps the previous map when a load fails', async () => {
    const loadVideoMap = vi
      .fn<(rangeNm: number) => Promise<ScopeVideoMap | undefined>>()
      .mockResolvedValueOnce(mapFor(60))
      .mockResolvedValueOnce(undefined);
    const { result, rerender } = renderHook(({ rangeNm }) => useVideoMap(rangeNm, loadVideoMap), {
      initialProps: { rangeNm: 60 },
    });
    await waitFor(() => expect(result.current).toEqual(mapFor(60)));

    rerender({ rangeNm: 40 });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toEqual(mapFor(60));
  });

  it('ignores a map that arrives for a range that has since been left', async () => {
    const releases = new Map<number, (map: ScopeVideoMap) => void>();
    const loadVideoMap = vi.fn(
      (rangeNm: number) =>
        new Promise<ScopeVideoMap>((resolve) => {
          releases.set(rangeNm, resolve);
        }),
    );
    const { result, rerender } = renderHook(({ rangeNm }) => useVideoMap(rangeNm, loadVideoMap), {
      initialProps: { rangeNm: 60 },
    });

    rerender({ rangeNm: 40 });
    await act(async () => {
      releases.get(40)?.(mapFor(40));
      releases.get(60)?.(mapFor(60));
      await Promise.resolve();
    });

    expect(result.current).toEqual(mapFor(40));
  });

  it('ignores a map that arrives after unmount', async () => {
    let release: (map: ScopeVideoMap) => void = () => undefined;
    const pending = new Promise<ScopeVideoMap>((resolve) => {
      release = resolve;
    });
    const { result, unmount } = renderHook(() => useVideoMap(60, () => pending));

    unmount();
    release(mapFor(60));
    await pending;

    expect(result.current).toBeUndefined();
  });
});
