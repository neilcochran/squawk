import type { ModeSetting, ModeSettingValues } from './mode.js';

/** Setting id: how much of the video map is drawn. */
export const MAP_SETTING_ID = 'map';

/**
 * How much of the video map is drawn. `basic` is what a scope's everyday map
 * carries - airspace boundaries, and airports with their runways. `full` adds
 * navaids and fixes, which are useful for orientation but numerous enough to
 * compete with the traffic. `off` draws no map.
 */
export type MapDetail = 'basic' | 'full' | 'off';

/** The map detail level used until another is chosen. */
export const DEFAULT_MAP_DETAIL: MapDetail = 'basic';

const MAP_DETAILS: readonly MapDetail[] = ['basic', 'full', 'off'];

/**
 * The video map. Offered by every view style, but declared by each as one of
 * its own settings, so each style remembers its own choice - the full map in
 * the digital style and none in the analog one, say.
 */
export const MAP_SETTING: ModeSetting = {
  id: MAP_SETTING_ID,
  label: 'Map',
  hotkey: 'v',
  choices: [
    { value: DEFAULT_MAP_DETAIL, label: 'Basic' },
    { value: 'full', label: 'Full' },
    { value: 'off', label: 'Off' },
  ],
};

/**
 * Reads how much of the video map should be drawn.
 *
 * @param values - The mode's current setting values.
 * @returns The chosen map detail level, or {@link DEFAULT_MAP_DETAIL} if none, or an unknown one, is stored.
 */
export function mapDetail(values: ModeSettingValues): MapDetail {
  const stored = values[MAP_SETTING_ID];
  return MAP_DETAILS.find((detail) => detail === stored) ?? DEFAULT_MAP_DETAIL;
}
