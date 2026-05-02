import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanHover } from './use-can-hover.ts';

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null;
  listeners: Set<(event: MediaQueryListEvent) => void>;
  addEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => void;
  addListener: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener: (listener: (event: MediaQueryListEvent) => void) => void;
  dispatchEvent: (event: Event) => boolean;
  fire: (matches: boolean) => void;
}

function buildMatchMediaWithList(list: MockMediaQueryList): (query: string) => MediaQueryList {
  return ((query: string): MediaQueryList => {
    list.media = query;
    return list as unknown as MediaQueryList;
  }) as (query: string) => MediaQueryList;
}

function buildMockList(initialMatches: boolean): MockMediaQueryList {
  const list: MockMediaQueryList = {
    matches: initialMatches,
    media: '(hover: hover)',
    onchange: null,
    listeners: new Set(),
    addEventListener: (_type, listener) => {
      list.listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      list.listeners.delete(listener);
    },
    addListener: (listener) => {
      list.listeners.add(listener);
    },
    removeListener: (listener) => {
      list.listeners.delete(listener);
    },
    dispatchEvent: () => true,
    fire: (matches) => {
      list.matches = matches;
      for (const listener of list.listeners) {
        listener({ matches } as MediaQueryListEvent);
      }
    },
  };
  return list;
}

const ORIGINAL_MATCH_MEDIA = window.matchMedia;

afterEach(() => {
  window.matchMedia = ORIGINAL_MATCH_MEDIA;
});

describe('useCanHover', () => {
  it('returns true when (hover: hover) initially matches', () => {
    const list = buildMockList(true);
    window.matchMedia = buildMatchMediaWithList(list);
    const { result } = renderHook(() => useCanHover());
    expect(result.current).toBe(true);
  });

  it('returns false when (hover: hover) does not match', () => {
    const list = buildMockList(false);
    window.matchMedia = buildMatchMediaWithList(list);
    const { result } = renderHook(() => useCanHover());
    expect(result.current).toBe(false);
  });

  it('updates when the media query change event fires', () => {
    const list = buildMockList(true);
    window.matchMedia = buildMatchMediaWithList(list);
    const { result } = renderHook(() => useCanHover());
    expect(result.current).toBe(true);
    act(() => {
      list.fire(false);
    });
    expect(result.current).toBe(false);
    act(() => {
      list.fire(true);
    });
    expect(result.current).toBe(true);
  });

  it('removes the change listener on unmount', () => {
    const list = buildMockList(true);
    window.matchMedia = buildMatchMediaWithList(list);
    const { unmount } = renderHook(() => useCanHover());
    expect(list.listeners.size).toBe(1);
    unmount();
    expect(list.listeners.size).toBe(0);
  });

  it('falls back to false when window.matchMedia is unavailable', () => {
    // Setting to undefined and casting through unknown so the hook's
    // `typeof window.matchMedia !== 'function'` guard fires.
    (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
    const { result } = renderHook(() => useCanHover());
    expect(result.current).toBe(false);
  });

  it('skips the subscribe effect when matchMedia is unavailable', () => {
    // Verifies the effect-side guard: setting matchMedia to undefined
    // before mount should not throw, and the hook should still return
    // its initial false value through the effect path.
    (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
    expect(() => renderHook(() => useCanHover())).not.toThrow();
  });
});
