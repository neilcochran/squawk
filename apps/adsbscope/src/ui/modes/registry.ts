import { SCOPE_MODE_IDS } from '../../shared/protocol.js';
import type { ScopeModeId } from '../../shared/protocol.js';
import { nextInCycle } from '../cycle.js';

import { ANALOG_MODE } from './analog/analog-mode.js';
import { DIGITAL_MODE } from './digital/digital-mode.js';
import type { ScopeModeDefinition } from './mode.js';

/**
 * Every view style, keyed by id. Typed as a complete record, so adding an id
 * to `SCOPE_MODE_IDS` without registering its mode here fails to compile.
 */
export const SCOPE_MODES_BY_ID: Readonly<Record<ScopeModeId, ScopeModeDefinition>> = {
  digital: DIGITAL_MODE,
  analog: ANALOG_MODE,
};

/** Every view style, in the order they are offered. */
export const SCOPE_MODES: readonly ScopeModeDefinition[] = SCOPE_MODE_IDS.map(
  (id) => SCOPE_MODES_BY_ID[id],
);

/**
 * Finds the view style after the given one, wrapping from the last back to
 * the first, for a control that cycles through them.
 *
 * @param current - The id of the current view style.
 * @returns The next view style.
 */
export function nextScopeMode(current: ScopeModeId): ScopeModeDefinition {
  return SCOPE_MODES_BY_ID[nextInCycle(SCOPE_MODE_IDS, current)];
}
