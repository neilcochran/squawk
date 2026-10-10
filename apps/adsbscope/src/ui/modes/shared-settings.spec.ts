import { describe, expect, it } from 'vitest';

import { defaultSettingValues, stepSetting } from './mode.js';
import { SCOPE_MODES } from './registry.js';
import {
  DEFAULT_LEADER_LENGTH,
  DEFAULT_MAP_DETAIL,
  HALO_OFF,
  HALO_RADIUS_NM_BY_VALUE,
  HALO_SETTING,
  HALO_SETTING_ID,
  haloRadiusNm,
  LEADER_SETTING,
  LEADER_SETTING_ID,
  leaderLength,
  MAP_SETTING,
  MAP_SETTING_ID,
  mapDetail,
} from './shared-settings.js';

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

describe('LEADER_SETTING', () => {
  it('is offered by every view style', () => {
    for (const mode of SCOPE_MODES) {
      expect(mode.settings).toContain(LEADER_SETTING);
    }
  });

  it('defaults to the short leader, then steps to the long one and back', () => {
    const short = defaultSettingValues({ ...SCOPE_MODES[0]!, settings: [LEADER_SETTING] });
    const long = stepSetting(LEADER_SETTING, short);

    expect(leaderLength(short)).toBe('short');
    expect(leaderLength(long)).toBe('long');
    expect(leaderLength(stepSetting(LEADER_SETTING, long))).toBe('short');
  });
});

describe('leaderLength', () => {
  it('is the short leader by default in every view style', () => {
    expect(DEFAULT_LEADER_LENGTH).toBe('short');
    for (const mode of SCOPE_MODES) {
      expect(leaderLength(defaultSettingValues(mode))).toBe(DEFAULT_LEADER_LENGTH);
    }
  });

  it('falls back to the default when nothing, or something unknown, is stored', () => {
    expect(leaderLength({})).toBe(DEFAULT_LEADER_LENGTH);
    expect(leaderLength({ [LEADER_SETTING_ID]: 'medium' })).toBe(DEFAULT_LEADER_LENGTH);
  });
});

describe('HALO_SETTING', () => {
  it('is offered by every view style', () => {
    for (const mode of SCOPE_MODES) {
      expect(mode.settings).toContain(HALO_SETTING);
    }
  });

  it('gives every choice but off a radius', () => {
    for (const choice of HALO_SETTING.choices) {
      if (choice.value === HALO_OFF) {
        expect(HALO_RADIUS_NM_BY_VALUE[choice.value]).toBeUndefined();
      } else {
        expect(HALO_RADIUS_NM_BY_VALUE[choice.value]).toBeGreaterThan(0);
      }
    }
  });

  it('starts off, then steps through the radii and back to off', () => {
    const off = defaultSettingValues({ ...SCOPE_MODES[0]!, settings: [HALO_SETTING] });
    const three = stepSetting(HALO_SETTING, off);
    const five = stepSetting(HALO_SETTING, three);

    expect(haloRadiusNm(off)).toBeUndefined();
    expect(haloRadiusNm(three)).toBe(3);
    expect(haloRadiusNm(five)).toBe(5);
    expect(haloRadiusNm(stepSetting(HALO_SETTING, five))).toBeUndefined();
  });
});

describe('haloRadiusNm', () => {
  it('draws no halo by default in every view style', () => {
    for (const mode of SCOPE_MODES) {
      expect(haloRadiusNm(defaultSettingValues(mode))).toBeUndefined();
    }
  });

  it('draws none when nothing, or something unknown, is stored', () => {
    expect(haloRadiusNm({})).toBeUndefined();
    expect(haloRadiusNm({ [HALO_SETTING_ID]: '10' })).toBeUndefined();
  });
});
