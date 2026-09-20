import type { ModeSetting, ScopeModeDefinition } from '../modes/mode.js';
import type { RangeDirection } from '../scope/range.js';
import type { SelectionDirection } from '../scope/selection.js';

import { rangeKeyDirection } from './range-keys.js';

/** The key that switches to the next view style. */
export const MODE_HOTKEY = 'm';

/** The `KeyboardEvent.key`, lowercase, that hides and shows the view style and setting controls. */
export const CONTROLS_HOTKEY = 'h';

/** The `KeyboardEvent.key` that selects the next aircraft. */
export const SELECT_NEXT_HOTKEY = '.';

/** The `KeyboardEvent.key` that selects the previous aircraft. */
export const SELECT_PREVIOUS_HOTKEY = ',';

/** The `KeyboardEvent.key` that clears the selection. */
export const DESELECT_HOTKEY = 'Escape';

/** What a key press asks the scope to do. */
export type HotkeyAction =
  | {
      /** Step the scope range. */
      type: 'range';
      /** The direction to step. */
      direction: RangeDirection;
    }
  | {
      /** Switch to the next view style. */
      type: 'nextMode';
    }
  | {
      /** Move the selection to another aircraft. */
      type: 'select';
      /** Which way to move it. */
      direction: SelectionDirection;
    }
  | {
      /** Clear the selection. */
      type: 'deselect';
    }
  | {
      /** Hide the view style and setting controls, or show them again. */
      type: 'toggleControls';
    }
  | {
      /** Step one of the active mode's settings to its next choice. */
      type: 'setting';
      /** The setting to step. */
      setting: ModeSetting;
    };

/** The parts of a `KeyboardEvent` that decide what a key press means. */
export interface KeyPress {
  /** The `KeyboardEvent.key` value. */
  key: string;
  /** Whether Ctrl was held. */
  ctrlKey: boolean;
  /** Whether Meta (Cmd / Windows) was held. */
  metaKey: boolean;
  /** Whether Alt was held. */
  altKey: boolean;
}

/**
 * Resolves a key press to the action it asks for, given the active mode.
 * Range keys come first, then the view style key, then the hotkeys of
 * whatever settings the active mode declares.
 *
 * A press with Ctrl, Meta, or Alt held is never a hotkey, so browser and OS
 * shortcuts keep working - Ctrl+R reloads the page rather than changing the
 * sweep rate. Shift is allowed, since `+` needs it on most layouts, and
 * letters match case-insensitively.
 *
 * @param press - The key press.
 * @param mode - The active view style.
 * @returns The action, or undefined if the press is not a hotkey.
 */
export function resolveHotkey(
  press: KeyPress,
  mode: ScopeModeDefinition,
): HotkeyAction | undefined {
  if (press.ctrlKey || press.metaKey || press.altKey) {
    return undefined;
  }
  const direction = rangeKeyDirection(press.key);
  if (direction !== undefined) {
    return { type: 'range', direction };
  }
  if (press.key === SELECT_NEXT_HOTKEY) {
    return { type: 'select', direction: 'next' };
  }
  if (press.key === SELECT_PREVIOUS_HOTKEY) {
    return { type: 'select', direction: 'previous' };
  }
  if (press.key === DESELECT_HOTKEY) {
    return { type: 'deselect' };
  }
  const key = press.key.toLowerCase();
  if (key === MODE_HOTKEY) {
    return { type: 'nextMode' };
  }
  if (key === CONTROLS_HOTKEY) {
    return { type: 'toggleControls' };
  }
  const setting = mode.settings.find((candidate) => candidate.hotkey === key);
  return setting === undefined ? undefined : { type: 'setting', setting };
}
