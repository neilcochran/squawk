import { DIGITAL_MODE } from './digital/digital-mode.js';
import type { ScopeModeDefinition } from './mode.js';

/** Every view style the scope offers, in the order they are presented. */
export const SCOPE_MODES: readonly ScopeModeDefinition[] = [DIGITAL_MODE];

/** The view style the scope opens in. */
export const DEFAULT_SCOPE_MODE: ScopeModeDefinition = DIGITAL_MODE;
