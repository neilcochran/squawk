import { describe, expect, it } from 'vitest';

import { TAGS_SETTING } from '../modes/analog/analog-settings.js';
import { SCOPE_MODES_BY_ID } from '../modes/registry.js';

import {
  CONTROLS_HOTKEY,
  DESELECT_HOTKEY,
  MODE_HOTKEY,
  resolveHotkey,
  SELECT_NEXT_HOTKEY,
  SELECT_PREVIOUS_HOTKEY,
} from './hotkeys.js';
import type { KeyPress } from './hotkeys.js';

const ANALOG = SCOPE_MODES_BY_ID.analog;
const DIGITAL = SCOPE_MODES_BY_ID.digital;

function press(key: string, modifiers: Partial<KeyPress> = {}): KeyPress {
  return { key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers };
}

describe('resolveHotkey', () => {
  it('resolves the range keys in any mode', () => {
    expect(resolveHotkey(press('+'), DIGITAL)).toEqual({ type: 'range', direction: 'in' });
    expect(resolveHotkey(press('['), ANALOG)).toEqual({ type: 'range', direction: 'out' });
  });

  it('resolves the view style key, in either case', () => {
    expect(resolveHotkey(press(MODE_HOTKEY), DIGITAL)).toEqual({ type: 'nextMode' });
    expect(resolveHotkey(press(MODE_HOTKEY.toUpperCase()), ANALOG)).toEqual({ type: 'nextMode' });
  });

  it("resolves a setting's hotkey only in the mode that declares it", () => {
    expect(resolveHotkey(press(TAGS_SETTING.hotkey), ANALOG)).toEqual({
      type: 'setting',
      setting: TAGS_SETTING,
    });
    expect(resolveHotkey(press(TAGS_SETTING.hotkey.toUpperCase()), ANALOG)).toEqual({
      type: 'setting',
      setting: TAGS_SETTING,
    });
    expect(resolveHotkey(press(TAGS_SETTING.hotkey), DIGITAL)).toBeUndefined();
  });

  it('resolves the key that hides and shows the controls, in either case', () => {
    expect(resolveHotkey(press(CONTROLS_HOTKEY), DIGITAL)).toEqual({ type: 'toggleControls' });
    expect(resolveHotkey(press(CONTROLS_HOTKEY.toUpperCase()), ANALOG)).toEqual({
      type: 'toggleControls',
    });
  });

  it('resolves the selection keys in any mode', () => {
    expect(resolveHotkey(press(SELECT_NEXT_HOTKEY), DIGITAL)).toEqual({
      type: 'select',
      direction: 'next',
    });
    expect(resolveHotkey(press(SELECT_PREVIOUS_HOTKEY), ANALOG)).toEqual({
      type: 'select',
      direction: 'previous',
    });
    expect(resolveHotkey(press(DESELECT_HOTKEY), ANALOG)).toEqual({ type: 'deselect' });
  });

  it('ignores keys that mean nothing', () => {
    expect(resolveHotkey(press('x'), ANALOG)).toBeUndefined();
    expect(resolveHotkey(press('Enter'), ANALOG)).toBeUndefined();
  });

  it('never treats a Ctrl, Meta, or Alt combination as a hotkey, so browser shortcuts keep working', () => {
    expect(resolveHotkey(press('r', { ctrlKey: true }), ANALOG)).toBeUndefined();
    expect(resolveHotkey(press('r', { metaKey: true }), ANALOG)).toBeUndefined();
    expect(resolveHotkey(press('m', { altKey: true }), ANALOG)).toBeUndefined();
    expect(resolveHotkey(press('+', { ctrlKey: true }), ANALOG)).toBeUndefined();
  });
});
