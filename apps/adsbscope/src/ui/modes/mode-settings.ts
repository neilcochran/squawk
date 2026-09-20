import type { ScopeModeId } from '../../shared/protocol.js';

import { defaultSettingValues } from './mode.js';
import type { ModeSettingValues } from './mode.js';
import { SCOPE_MODES_BY_ID } from './registry.js';

/**
 * Every view style's current setting values. Each style keeps its own, so
 * they survive switching away and back. A complete record, so a new mode id
 * that is not handled here fails to compile.
 */
export type SettingValuesByMode = Readonly<Record<ScopeModeId, ModeSettingValues>>;

/**
 * Builds every view style's settings at their defaults.
 *
 * @returns The starting setting values of each view style.
 */
export function defaultSettingValuesByMode(): SettingValuesByMode {
  return {
    digital: defaultSettingValues(SCOPE_MODES_BY_ID.digital),
    analog: defaultSettingValues(SCOPE_MODES_BY_ID.analog),
  };
}

/**
 * Replaces one view style's setting values, leaving the others as they were.
 *
 * The mode id can come from outside the app - the page URL, or the server's
 * config - so it is never used as a computed property name: each style is
 * written under its own literal key.
 *
 * @param all - Every view style's current setting values.
 * @param modeId - The view style whose values are being replaced.
 * @param values - Its new values.
 * @returns A new record with that style's values replaced.
 */
export function withModeSettingValues(
  all: SettingValuesByMode,
  modeId: ScopeModeId,
  values: ModeSettingValues,
): SettingValuesByMode {
  switch (modeId) {
    case 'digital':
      return { ...all, digital: values };
    case 'analog':
      return { ...all, analog: values };
  }
}
