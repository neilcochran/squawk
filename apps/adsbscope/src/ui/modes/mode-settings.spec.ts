import { describe, expect, it } from 'vitest';

import { SCOPE_MODE_IDS } from '../../shared/protocol.js';

import { defaultSettingValuesByMode, withModeSettingValues } from './mode-settings.js';
import { defaultSettingValues } from './mode.js';
import { SCOPE_MODES_BY_ID } from './registry.js';

describe('defaultSettingValuesByMode', () => {
  it("starts every view style at its own settings' defaults", () => {
    const all = defaultSettingValuesByMode();

    expect(Object.keys(all).sort()).toEqual([...SCOPE_MODE_IDS].sort());
    for (const id of SCOPE_MODE_IDS) {
      expect(all[id]).toEqual(defaultSettingValues(SCOPE_MODES_BY_ID[id]));
    }
  });
});

describe('withModeSettingValues', () => {
  it("replaces one view style's values and leaves every other style's alone", () => {
    const all = defaultSettingValuesByMode();

    for (const id of SCOPE_MODE_IDS) {
      const values = { changed: id };

      const next = withModeSettingValues(all, id, values);

      expect(next[id]).toBe(values);
      for (const other of SCOPE_MODE_IDS.filter((candidate) => candidate !== id)) {
        expect(next[other]).toBe(all[other]);
      }
    }
  });

  it('returns a new record rather than changing the one it was given', () => {
    const all = defaultSettingValuesByMode();
    const before = { ...all };

    const next = withModeSettingValues(all, 'analog', { tags: 'off' });

    expect(next).not.toBe(all);
    expect(all).toEqual(before);
  });
});
