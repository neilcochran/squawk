import { describe, expect, it } from 'vitest';

import { defaultSettingValues } from '../mode.js';

import { ANALOG_MODE } from './analog-mode.js';
import {
  ANALOG_SETTINGS,
  areTagsVisible,
  DEFAULT_SWEEP_PERIOD_MS,
  SWEEP_PERIOD_MS_BY_VALUE,
  SWEEP_SETTING,
  SWEEP_SETTING_ID,
  sweepPeriodMs,
  TAGS_OFF,
  TAGS_ON,
  TAGS_SETTING_ID,
} from './analog-settings.js';

describe('the analog settings', () => {
  it('have distinct ids and hotkeys', () => {
    expect(new Set(ANALOG_SETTINGS.map((setting) => setting.id)).size).toBe(ANALOG_SETTINGS.length);
    expect(new Set(ANALOG_SETTINGS.map((setting) => setting.hotkey)).size).toBe(
      ANALOG_SETTINGS.length,
    );
  });

  it('give every sweep choice a rotation period', () => {
    for (const choice of SWEEP_SETTING.choices) {
      expect(SWEEP_PERIOD_MS_BY_VALUE[choice.value]).toBeGreaterThan(0);
    }
  });
});

describe('areTagsVisible', () => {
  it('is on by default', () => {
    expect(areTagsVisible(defaultSettingValues(ANALOG_MODE))).toBe(true);
    expect(areTagsVisible({})).toBe(true);
  });

  it('follows the tags setting', () => {
    expect(areTagsVisible({ [TAGS_SETTING_ID]: TAGS_ON })).toBe(true);
    expect(areTagsVisible({ [TAGS_SETTING_ID]: TAGS_OFF })).toBe(false);
  });
});

describe('sweepPeriodMs', () => {
  it('defaults to the terminal radar rate', () => {
    expect(sweepPeriodMs(defaultSettingValues(ANALOG_MODE))).toBe(4800);
    expect(sweepPeriodMs({})).toBe(DEFAULT_SWEEP_PERIOD_MS);
  });

  it('reads the long-range rate', () => {
    expect(sweepPeriodMs({ [SWEEP_SETTING_ID]: 'longRange' })).toBe(12_000);
  });

  it('falls back to the default rate for an unknown value', () => {
    expect(sweepPeriodMs({ [SWEEP_SETTING_ID]: 'warp' })).toBe(DEFAULT_SWEEP_PERIOD_MS);
  });
});
