import { afterEach, describe, expect, it } from 'vitest';

import {
  MAP_CONTROLS_INSET_CSS_VAR,
  readPublishedMapControlsInsetPx,
} from './map-controls-inset.ts';

describe('readPublishedMapControlsInsetPx', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty(MAP_CONTROLS_INSET_CSS_VAR);
  });

  it('reads the published pixel inset', () => {
    document.documentElement.style.setProperty(MAP_CONTROLS_INSET_CSS_VAR, '56px');
    expect(readPublishedMapControlsInsetPx()).toBe(56);
  });

  it('falls back to zero when nothing is published', () => {
    expect(readPublishedMapControlsInsetPx()).toBe(0);
  });

  it('falls back to zero for a value that is not in pixels', () => {
    document.documentElement.style.setProperty(MAP_CONTROLS_INSET_CSS_VAR, '3.5rem');
    expect(readPublishedMapControlsInsetPx()).toBe(0);
  });
});
