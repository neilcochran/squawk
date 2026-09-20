import type { ScopeModeDefinition } from '../mode.js';
import { MAP_SETTING } from '../shared-settings.js';

import { createDigitalRenderer } from './digital-renderer.js';
import { DIGITAL_THEME } from './digital-theme.js';

/** The `digital` view style: a modern ATC scope with no sweep. */
export const DIGITAL_MODE: ScopeModeDefinition = {
  id: 'digital',
  label: 'Digital',
  theme: DIGITAL_THEME,
  settings: [MAP_SETTING],
  createRenderer: () => createDigitalRenderer(DIGITAL_THEME),
};
