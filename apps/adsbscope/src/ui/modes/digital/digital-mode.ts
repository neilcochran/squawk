import type { ScopeModeDefinition } from '../mode.js';
import { MAP_SETTING } from '../shared-settings.js';

import { createDigitalRenderer, DIGITAL_EXTENT } from './digital-renderer.js';
import { DIGITAL_THEME } from './digital-theme.js';

/** The `digital` view style: a modern ATC scope with no sweep. */
export const DIGITAL_MODE: ScopeModeDefinition = {
  id: 'digital',
  label: 'Digital',
  theme: DIGITAL_THEME,
  extent: DIGITAL_EXTENT,
  settings: [MAP_SETTING],
  createRenderer: () => createDigitalRenderer(DIGITAL_THEME),
};
