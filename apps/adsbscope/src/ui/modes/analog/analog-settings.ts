import { selectedChoice } from '../mode.js';
import type { ModeSetting, ModeSettingValues } from '../mode.js';
import { MAP_SETTING } from '../shared-settings.js';

/** Setting id: whether data tags are drawn beside the blips. */
export const TAGS_SETTING_ID = 'tags';

/** Value of {@link TAGS_SETTING_ID} that draws the tags. */
export const TAGS_ON = 'on';

/** Setting id: how fast the antenna rotates. */
export const SWEEP_SETTING_ID = 'sweep';

/** Antenna rotation period, in ms, for each value of {@link SWEEP_SETTING_ID}. */
export const SWEEP_PERIOD_MS_BY_VALUE: Readonly<Record<string, number>> = {
  terminal: 4800,
  longRange: 12_000,
};

/** The rotation period used when the sweep setting is unset or holds a value with no period. */
export const DEFAULT_SWEEP_PERIOD_MS = 4800;

/**
 * Data tags. A sweep-era scope had none - controllers tracked identity on
 * paper strips - so they are off until asked for.
 */
export const TAGS_SETTING: ModeSetting = {
  id: TAGS_SETTING_ID,
  label: 'Tags',
  hotkey: 't',
  choices: [
    { value: 'off', label: 'Off' },
    { value: TAGS_ON, label: 'On' },
  ],
};

/** Antenna rotation rate: a terminal approach radar turns about every 4.8 s, a long-range en-route radar about every 12 s. */
export const SWEEP_SETTING: ModeSetting = {
  id: SWEEP_SETTING_ID,
  label: 'Sweep',
  hotkey: 'r',
  choices: [
    { value: 'terminal', label: '4.8 s' },
    { value: 'longRange', label: '12 s' },
  ],
};

/** Everything the user can adjust in the analog mode. */
export const ANALOG_SETTINGS: readonly ModeSetting[] = [TAGS_SETTING, SWEEP_SETTING, MAP_SETTING];

/**
 * Reads whether data tags should be drawn.
 *
 * @param values - The mode's current setting values.
 * @returns True if tags are on.
 */
export function areTagsVisible(values: ModeSettingValues): boolean {
  return selectedChoice(TAGS_SETTING, values).value === TAGS_ON;
}

/**
 * Reads the antenna rotation period.
 *
 * @param values - The mode's current setting values.
 * @returns The rotation period in ms.
 */
export function sweepPeriodMs(values: ModeSettingValues): number {
  const value = values[SWEEP_SETTING_ID];
  const periodMs = value === undefined ? undefined : SWEEP_PERIOD_MS_BY_VALUE[value];
  return periodMs ?? DEFAULT_SWEEP_PERIOD_MS;
}
