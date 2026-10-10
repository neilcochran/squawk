import { describe, expect, it } from 'vitest';

import { defaultSettingValues } from '../mode.js';
import { HALO_SETTING, LEADER_SETTING, MAP_SETTING } from '../shared-settings.js';

import { DIGITAL_MODE } from './digital-mode.js';
import {
  DEFAULT_VECTOR_MINUTES,
  DIGITAL_SETTINGS,
  VECTOR_MINUTES_BY_VALUE,
  VECTOR_SETTING,
  VECTOR_SETTING_ID,
  vectorMinutes,
} from './digital-settings.js';

describe('the digital settings', () => {
  it('have distinct ids and hotkeys', () => {
    expect(new Set(DIGITAL_SETTINGS.map((setting) => setting.id)).size).toBe(
      DIGITAL_SETTINGS.length,
    );
    expect(new Set(DIGITAL_SETTINGS.map((setting) => setting.hotkey)).size).toBe(
      DIGITAL_SETTINGS.length,
    );
  });

  it('give every vector choice a length', () => {
    for (const choice of VECTOR_SETTING.choices) {
      expect(VECTOR_MINUTES_BY_VALUE[choice.value]).toBeGreaterThan(0);
    }
  });

  it('end with the settings every view style shares, in one order', () => {
    expect(DIGITAL_SETTINGS.slice(-3)).toEqual([LEADER_SETTING, HALO_SETTING, MAP_SETTING]);
  });
});

describe('vectorMinutes', () => {
  it('defaults to one minute', () => {
    expect(vectorMinutes(defaultSettingValues(DIGITAL_MODE))).toBe(1);
    expect(vectorMinutes({})).toBe(DEFAULT_VECTOR_MINUTES);
  });

  it('reads the longer vectors', () => {
    expect(vectorMinutes({ [VECTOR_SETTING_ID]: '2' })).toBe(2);
    expect(vectorMinutes({ [VECTOR_SETTING_ID]: '4' })).toBe(4);
  });

  it('falls back to the default for an unknown value', () => {
    expect(vectorMinutes({ [VECTOR_SETTING_ID]: '90' })).toBe(DEFAULT_VECTOR_MINUTES);
  });
});
