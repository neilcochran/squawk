import { describe, expect, it } from 'vitest';

import { defaultSettingValues, stepSetting } from './mode.js';
import { SCOPE_MODES } from './registry.js';
import { DEFAULT_MAP_DETAIL, MAP_SETTING, MAP_SETTING_ID, mapDetail } from './shared-settings.js';

describe('MAP_SETTING', () => {
  it('is offered by every view style', () => {
    for (const mode of SCOPE_MODES) {
      expect(mode.settings).toContain(MAP_SETTING);
    }
  });

  it('defaults to the basic map, then steps to the full map, then off', () => {
    const basic = defaultSettingValues({ ...SCOPE_MODES[0]!, settings: [MAP_SETTING] });
    const full = stepSetting(MAP_SETTING, basic);
    const off = stepSetting(MAP_SETTING, full);

    expect(mapDetail(basic)).toBe('basic');
    expect(mapDetail(full)).toBe('full');
    expect(mapDetail(off)).toBe('off');
    expect(mapDetail(stepSetting(MAP_SETTING, off))).toBe('basic');
  });
});

describe('mapDetail', () => {
  it('is the basic map by default in every view style', () => {
    expect(DEFAULT_MAP_DETAIL).toBe('basic');
    for (const mode of SCOPE_MODES) {
      expect(mapDetail(defaultSettingValues(mode))).toBe(DEFAULT_MAP_DETAIL);
    }
  });

  it('reads each chosen level', () => {
    expect(mapDetail({ [MAP_SETTING_ID]: 'full' })).toBe('full');
    expect(mapDetail({ [MAP_SETTING_ID]: 'off' })).toBe('off');
    expect(mapDetail({ [MAP_SETTING_ID]: 'basic' })).toBe('basic');
  });

  it('falls back to the default when nothing, or something unknown, is stored', () => {
    expect(mapDetail({})).toBe(DEFAULT_MAP_DETAIL);
    expect(mapDetail({ [MAP_SETTING_ID]: 'nonsense' })).toBe(DEFAULT_MAP_DETAIL);
  });
});
