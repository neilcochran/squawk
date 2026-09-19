import { describe, expect, it } from 'vitest';

import { DIGITAL_MODE } from './digital/digital-mode.js';
import { defaultSettingValues, selectedChoice, selectSetting, stepSetting } from './mode.js';
import type { ModeSetting, ScopeModeDefinition } from './mode.js';

const SPEED: ModeSetting = {
  id: 'speed',
  label: 'Speed',
  hotkey: 's',
  choices: [
    { value: 'slow', label: 'Slow' },
    { value: 'medium', label: 'Medium' },
    { value: 'fast', label: 'Fast' },
  ],
};

const GRID: ModeSetting = {
  id: 'grid',
  label: 'Grid',
  hotkey: 'g',
  choices: [
    { value: 'off', label: 'Grid off' },
    { value: 'on', label: 'Grid on' },
  ],
};

const MODE: ScopeModeDefinition = { ...DIGITAL_MODE, settings: [SPEED, GRID] };

describe('defaultSettingValues', () => {
  it('selects the first choice of every setting', () => {
    expect(defaultSettingValues(MODE)).toEqual({ speed: 'slow', grid: 'off' });
  });

  it('is empty for a mode with nothing to adjust', () => {
    expect(defaultSettingValues(DIGITAL_MODE)).toEqual({});
  });
});

describe('selectedChoice', () => {
  it('finds the choice matching the stored value', () => {
    expect(selectedChoice(SPEED, { speed: 'fast' })).toEqual({ value: 'fast', label: 'Fast' });
  });

  it('falls back to the default choice for a missing or unknown value', () => {
    expect(selectedChoice(SPEED, {}).value).toBe('slow');
    expect(selectedChoice(SPEED, { speed: 'ludicrous' }).value).toBe('slow');
  });
});

describe('selectSetting', () => {
  it('selects the given choice and leaves the other settings alone', () => {
    expect(selectSetting(SPEED, { speed: 'slow', grid: 'on' }, 'fast')).toEqual({
      speed: 'fast',
      grid: 'on',
    });
  });

  it('ignores a value that is not one of the choices, returning the same values', () => {
    const values = { speed: 'slow' };

    expect(selectSetting(SPEED, values, 'ludicrous')).toBe(values);
  });

  it('does not mutate the values it is given', () => {
    const values = { speed: 'slow' };

    selectSetting(SPEED, values, 'fast');

    expect(values).toEqual({ speed: 'slow' });
  });
});

describe('stepSetting', () => {
  it('advances one setting to its next choice and leaves the others alone', () => {
    expect(stepSetting(SPEED, { speed: 'slow', grid: 'on' })).toEqual({
      speed: 'medium',
      grid: 'on',
    });
  });

  it('wraps from the last choice back to the first', () => {
    expect(stepSetting(SPEED, { speed: 'fast' })).toEqual({ speed: 'slow' });
    expect(stepSetting(GRID, { grid: 'on' })).toEqual({ grid: 'off' });
  });

  it('steps from the default when the stored value is missing or unknown', () => {
    expect(stepSetting(SPEED, {})).toEqual({ speed: 'medium' });
    expect(stepSetting(SPEED, { speed: 'ludicrous' })).toEqual({ speed: 'medium' });
  });

  it('does not mutate the values it is given', () => {
    const values = { speed: 'slow' };

    stepSetting(SPEED, values);

    expect(values).toEqual({ speed: 'slow' });
  });
});
