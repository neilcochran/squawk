import { afterEach, describe, it, expect, vi } from 'vitest';

import {
  SIDE_PANEL_DEFAULT_WIDTH_PX,
  SIDE_PANEL_MAX_WIDTH_PX,
  SIDE_PANEL_MIN_WIDTH_PX,
  clampSidePanelWidthPx,
  readPublishedSidePanelWidthPx,
  readStoredSidePanelWidthPx,
  writeStoredSidePanelWidthPx,
} from './side-panel-width.ts';

const KEY = 'atlas:test:width:v1';

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.style.removeProperty('--atlas-side-panel-width');
  vi.restoreAllMocks();
});

describe('clampSidePanelWidthPx', () => {
  it('keeps a width inside the bounds, rounded to a whole pixel', () => {
    expect(clampSidePanelWidthPx(400.6, 1600)).toBe(401);
  });

  it('raises a width below the minimum', () => {
    expect(clampSidePanelWidthPx(100, 1600)).toBe(SIDE_PANEL_MIN_WIDTH_PX);
  });

  it('caps a width at the maximum on a wide viewport', () => {
    expect(clampSidePanelWidthPx(2000, 1600)).toBe(SIDE_PANEL_MAX_WIDTH_PX);
  });

  it('caps a width at 60% of a narrower viewport', () => {
    expect(clampSidePanelWidthPx(2000, 900)).toBe(540);
  });

  it('lets the minimum win on a viewport too narrow for it', () => {
    expect(clampSidePanelWidthPx(2000, 400)).toBe(SIDE_PANEL_MIN_WIDTH_PX);
  });
});

describe('readStoredSidePanelWidthPx', () => {
  it('returns undefined when nothing is stored', () => {
    expect(readStoredSidePanelWidthPx(KEY)).toBeUndefined();
  });

  it('reads a stored width', () => {
    window.localStorage.setItem(KEY, '480');
    expect(readStoredSidePanelWidthPx(KEY)).toBe(480);
  });

  it('ignores a stored value that is not a number', () => {
    window.localStorage.setItem(KEY, 'wide');
    expect(readStoredSidePanelWidthPx(KEY)).toBeUndefined();
  });

  it('returns undefined when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(readStoredSidePanelWidthPx(KEY)).toBeUndefined();
  });
});

describe('writeStoredSidePanelWidthPx', () => {
  it('stores a width', () => {
    writeStoredSidePanelWidthPx(KEY, 512);
    expect(window.localStorage.getItem(KEY)).toBe('512');
  });

  it('forgets the width when given undefined', () => {
    window.localStorage.setItem(KEY, '512');
    writeStoredSidePanelWidthPx(KEY, undefined);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('swallows a failing write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => {
      writeStoredSidePanelWidthPx(KEY, 512);
    }).not.toThrow();
  });
});

describe('readPublishedSidePanelWidthPx', () => {
  it('falls back to the default when no panel has published a width', () => {
    expect(readPublishedSidePanelWidthPx()).toBe(SIDE_PANEL_DEFAULT_WIDTH_PX);
  });

  it('reads the pixel width a panel published', () => {
    document.documentElement.style.setProperty('--atlas-side-panel-width', '512px');
    expect(readPublishedSidePanelWidthPx()).toBe(512);
  });

  it('falls back to the default for a non-pixel value', () => {
    document.documentElement.style.setProperty('--atlas-side-panel-width', '22.5rem');
    expect(readPublishedSidePanelWidthPx()).toBe(SIDE_PANEL_DEFAULT_WIDTH_PX);
  });
});
