import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMapZoom } from './use-map-zoom.ts';

const { useMapMock } = vi.hoisted(() => ({
  useMapMock: vi.fn(),
}));

vi.mock('@vis.gl/react-maplibre', () => ({
  useMap: useMapMock,
}));

/** Minimal stand-in for the MapLibre map: a settable zoom plus `on` / `off`. */
function createFakeMap(initialZoom: number): {
  map: {
    getZoom: () => number;
    on: (event: string, handler: () => void) => void;
    off: (event: string, handler: () => void) => void;
  };
  setZoom: (zoom: number) => void;
  handlers: Map<string, () => void>;
  off: ReturnType<typeof vi.fn>;
} {
  let zoom = initialZoom;
  const handlers = new Map<string, () => void>();
  const off = vi.fn((event: string) => {
    handlers.delete(event);
  });
  return {
    map: {
      getZoom: (): number => zoom,
      on: (event: string, handler: () => void): void => {
        handlers.set(event, handler);
      },
      off,
    },
    setZoom: (next: number): void => {
      zoom = next;
      handlers.get('zoom')?.();
    },
    handlers,
    off,
  };
}

describe('useMapZoom', () => {
  beforeEach(() => {
    useMapMock.mockReset();
  });

  it('returns the quantized fallback when no map is mounted', () => {
    useMapMock.mockReturnValue({ current: undefined, default: undefined });
    const { result } = renderHook(() => useMapZoom(8.74));
    expect(result.current).toBeCloseTo(8.7, 10);
  });

  it('reads the live zoom from the map on first render', () => {
    const fake = createFakeMap(5.26);
    useMapMock.mockReturnValue({ current: { getMap: () => fake.map }, default: undefined });
    const { result } = renderHook(() => useMapZoom(4));
    expect(result.current).toBeCloseTo(5.3, 10);
  });

  it('follows zoom events and quantizes them', () => {
    const fake = createFakeMap(5);
    useMapMock.mockReturnValue({ current: { getMap: () => fake.map }, default: undefined });
    const { result } = renderHook(() => useMapZoom(4));
    act(() => {
      fake.setZoom(7.04);
    });
    expect(result.current).toBeCloseTo(7, 10);
    act(() => {
      fake.setZoom(7.06);
    });
    expect(result.current).toBeCloseTo(7.1, 10);
  });

  it('unsubscribes from the map on unmount', () => {
    const fake = createFakeMap(5);
    useMapMock.mockReturnValue({ current: undefined, default: { getMap: () => fake.map } });
    const { unmount } = renderHook(() => useMapZoom(4));
    expect(fake.handlers.has('zoom')).toBe(true);
    unmount();
    expect(fake.off).toHaveBeenCalledWith('zoom', expect.any(Function));
    expect(fake.handlers.has('zoom')).toBe(false);
  });
});
