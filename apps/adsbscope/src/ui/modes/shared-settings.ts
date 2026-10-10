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

/** Setting id: how long the leader line from a target to its data block or tag is. */
export const LEADER_SETTING_ID = 'leader';

/** How long a leader line is. Each view style has its own length, in rem, for each. */
export type LeaderLength = 'short' | 'long';

/** The leader length used until another is chosen. */
export const DEFAULT_LEADER_LENGTH: LeaderLength = 'short';

const LEADER_LENGTHS: readonly LeaderLength[] = ['short', 'long'];

/**
 * Leader line length. A short leader keeps a block close to its target; a
 * long one holds it clear of the history trail, the vector, and a neighbor's
 * block in a crowd. Offered by every view style, and declared by each as one
 * of its own settings, as the map is.
 */
export const LEADER_SETTING: ModeSetting = {
  id: LEADER_SETTING_ID,
  label: 'Leader',
  hotkey: 'l',
  choices: [
    { value: DEFAULT_LEADER_LENGTH, label: 'Short' },
    { value: 'long', label: 'Long' },
  ],
};

/**
 * Reads how long leader lines should be.
 *
 * @param values - The mode's current setting values.
 * @returns The chosen leader length, or {@link DEFAULT_LEADER_LENGTH} if none, or an unknown one, is stored.
 */
export function leaderLength(values: ModeSettingValues): LeaderLength {
  const stored = values[LEADER_SETTING_ID];
  return LEADER_LENGTHS.find((length) => length === stored) ?? DEFAULT_LEADER_LENGTH;
}

/** Setting id: the radius of the halo drawn around the selected target. */
export const HALO_SETTING_ID = 'halo';

/** Value of {@link HALO_SETTING_ID} that draws no halo. */
export const HALO_OFF = 'off';

/** Halo radius, in nautical miles, for each value of {@link HALO_SETTING_ID} that draws one. */
export const HALO_RADIUS_NM_BY_VALUE: Readonly<Record<string, number>> = {
  '3': 3,
  '5': 5,
};

/**
 * The halo: a ring of fixed radius around the selected target - the J-ring
 * of a real scope - for judging separation by eye. It is drawn to scale, in
 * nautical miles, so it follows the range. Off until turned on, and offered
 * by every view style as its own setting, as the map is.
 */
export const HALO_SETTING: ModeSetting = {
  id: HALO_SETTING_ID,
  label: 'Ring',
  hotkey: 'j',
  choices: [
    { value: HALO_OFF, label: 'Off' },
    { value: '3', label: '3 nm' },
    { value: '5', label: '5 nm' },
  ],
};

/**
 * Reads the radius of the halo to draw around the selected target.
 *
 * @param values - The mode's current setting values.
 * @returns The radius in nautical miles, or undefined for no halo - the default, and what an unknown value gets.
 */
export function haloRadiusNm(values: ModeSettingValues): number | undefined {
  const stored = values[HALO_SETTING_ID];
  return stored === undefined ? undefined : HALO_RADIUS_NM_BY_VALUE[stored];
}
