import type { ScopeModeDefinition } from '../mode.js';

import { createAnalogRenderer } from './analog-renderer.js';
import { ANALOG_SETTINGS } from './analog-settings.js';
import { ANALOG_THEME } from './analog-theme.js';

/** The `analog` view style: a sweep-era PPI scope with a rotating beam and fading returns. */
export const ANALOG_MODE: ScopeModeDefinition = {
  id: 'analog',
  label: 'Analog',
  theme: ANALOG_THEME,
  settings: ANALOG_SETTINGS,
  createRenderer: () => createAnalogRenderer(ANALOG_THEME),
};
