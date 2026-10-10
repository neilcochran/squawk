import type { ModeSetting, ModeSettingValues } from '../mode.js';
import { HALO_SETTING, LEADER_SETTING, MAP_SETTING } from '../shared-settings.js';

/** Setting id: how far ahead the velocity vector reaches. */
export const VECTOR_SETTING_ID = 'vector';

/** Minutes of flight the velocity vector reaches ahead, for each value of {@link VECTOR_SETTING_ID}. */
export const VECTOR_MINUTES_BY_VALUE: Readonly<Record<string, number>> = {
  '1': 1,
  '2': 2,
  '4': 4,
};

/** The vector length used when the vector setting is unset or holds a value with no length. */
export const DEFAULT_VECTOR_MINUTES = 1;

/**
 * Velocity vector length: where an aircraft will be in one, two, or four
 * minutes at its current track and ground speed. A longer vector shows a
 * converging pair sooner; a shorter one keeps a busy scope legible.
 */
export const VECTOR_SETTING: ModeSetting = {
  id: VECTOR_SETTING_ID,
  label: 'Vector',
  hotkey: 'p',
  choices: [
    { value: '1', label: '1 min' },
    { value: '2', label: '2 min' },
    { value: '4', label: '4 min' },
  ],
};

/** Everything the user can adjust in the digital mode. */
export const DIGITAL_SETTINGS: readonly ModeSetting[] = [
  VECTOR_SETTING,
  LEADER_SETTING,
  HALO_SETTING,
  MAP_SETTING,
];

/**
 * Reads how far ahead the velocity vector reaches.
 *
 * @param values - The mode's current setting values.
 * @returns Minutes of flight at the current ground speed.
 */
export function vectorMinutes(values: ModeSettingValues): number {
  const value = values[VECTOR_SETTING_ID];
  const minutes = value === undefined ? undefined : VECTOR_MINUTES_BY_VALUE[value];
  return minutes ?? DEFAULT_VECTOR_MINUTES;
}
