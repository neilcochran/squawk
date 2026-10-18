import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useViewStateWriteBack } from './use-view-state-write-back.ts';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

describe('useViewStateWriteBack', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('replaces the current route with the settled camera', () => {
    const { result } = renderHook(() => useViewStateWriteBack());
    result.current({ lat: 41, lon: -71, zoom: 8, pitch: 30 });
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock.mock.calls[0]?.[0]).toMatchObject({ to: '.', replace: true });
  });

  it('writes the four view fields and passes every other search field through', () => {
    const { result } = renderHook(() => useViewStateWriteBack());
    result.current({ lat: 41, lon: -71, zoom: 8, pitch: 30 });
    const search = navigateMock.mock.calls[0]?.[0]?.search;
    expect(search({ lat: 39.5, lon: -98.5, zoom: 4, pitch: 0, route: 'KBOS DCT KJFK' })).toEqual({
      lat: 41,
      lon: -71,
      zoom: 8,
      pitch: 30,
      route: 'KBOS DCT KJFK',
    });
  });

  it('returns a stable callback across renders', () => {
    const { result, rerender } = renderHook(() => useViewStateWriteBack());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
