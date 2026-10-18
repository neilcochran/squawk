import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import { useSidePanelWidth } from './use-side-panel-width.ts';

const KEY = 'atlas:test:width:v1';

const originalInnerWidth = window.innerWidth;

/** Sets the jsdom viewport width the hook clamps against. */
function setViewportWidth(widthPx: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: widthPx,
  });
}

/** The width the hook has published on documentElement. */
function publishedWidth(): string {
  return document.documentElement.style.getPropertyValue('--atlas-side-panel-width');
}

/** The open width the hook has published on documentElement. */
function publishedOpenWidth(): string {
  return document.documentElement.style.getPropertyValue('--atlas-side-panel-open-width');
}

beforeEach(() => {
  setViewportWidth(1600);
});

afterEach(() => {
  setViewportWidth(originalInnerWidth);
  window.localStorage.clear();
});

describe('useSidePanelWidth', () => {
  it('starts at the default width and publishes it while mounted', () => {
    const { result, unmount } = renderHook(() => useSidePanelWidth(KEY));
    expect(result.current.widthPx).toBe(360);
    expect(result.current.minWidthPx).toBe(320);
    expect(result.current.maxWidthPx).toBe(640);
    expect(publishedWidth()).toBe('360px');

    unmount();
    expect(publishedWidth()).toBe('');
  });

  it('publishes the open width only while the panel is on screen', () => {
    const { rerender, unmount } = renderHook(
      ({ open }: { open: boolean }) => useSidePanelWidth(KEY, open),
      { initialProps: { open: false } },
    );
    expect(publishedWidth()).toBe('360px');
    expect(publishedOpenWidth()).toBe('');

    rerender({ open: true });
    expect(publishedOpenWidth()).toBe('360px');

    rerender({ open: false });
    expect(publishedOpenWidth()).toBe('');
    expect(publishedWidth()).toBe('360px');

    rerender({ open: true });
    unmount();
    expect(publishedOpenWidth()).toBe('');
  });

  it('starts at the width stored for this panel', () => {
    window.localStorage.setItem(KEY, '480');
    const { result } = renderHook(() => useSidePanelWidth(KEY));
    expect(result.current.widthPx).toBe(480);
    expect(publishedWidth()).toBe('480px');
  });

  it('previews a width without storing it', () => {
    const { result } = renderHook(() => useSidePanelWidth(KEY));
    act(() => {
      result.current.previewWidthPx(500);
    });
    expect(result.current.widthPx).toBe(500);
    expect(publishedWidth()).toBe('500px');
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('commits a width clamped to the bounds and stores it', () => {
    const { result } = renderHook(() => useSidePanelWidth(KEY));
    act(() => {
      result.current.commitWidthPx(9999);
    });
    expect(result.current.widthPx).toBe(640);
    expect(window.localStorage.getItem(KEY)).toBe('640');
  });

  it('resets to the default and forgets the stored width', () => {
    window.localStorage.setItem(KEY, '480');
    const { result } = renderHook(() => useSidePanelWidth(KEY));
    act(() => {
      result.current.resetWidth();
    });
    expect(result.current.widthPx).toBe(360);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('narrows to fit a smaller window and restores the chosen width when it grows back', () => {
    window.localStorage.setItem(KEY, '600');
    const { result } = renderHook(() => useSidePanelWidth(KEY));
    expect(result.current.widthPx).toBe(600);

    act(() => {
      setViewportWidth(800);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.widthPx).toBe(480);
    expect(result.current.maxWidthPx).toBe(480);

    act(() => {
      setViewportWidth(1600);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.widthPx).toBe(600);
  });
});
