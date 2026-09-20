import { describe, expect, it } from 'vitest';

import { DEFAULT_SCOPE_MODE_ID, SCOPE_MODE_IDS } from '../../shared/protocol.js';
import {
  CONTROLS_HOTKEY,
  MODE_HOTKEY,
  SELECT_NEXT_HOTKEY,
  SELECT_PREVIOUS_HOTKEY,
} from '../hud/hotkeys.js';
import { RANGE_KEYS } from '../hud/range-keys.js';
import { isHexColor } from '../scope/color.js';

import { nextScopeMode, SCOPE_MODES, SCOPE_MODES_BY_ID } from './registry.js';

describe('the mode registry', () => {
  it('registers every mode id under its own id, in the offered order', () => {
    expect(SCOPE_MODES.map((mode) => mode.id)).toEqual([...SCOPE_MODE_IDS]);
    for (const id of SCOPE_MODE_IDS) {
      expect(SCOPE_MODES_BY_ID[id].id).toBe(id);
    }
  });

  it('includes the default mode', () => {
    expect(SCOPE_MODES_BY_ID[DEFAULT_SCOPE_MODE_ID]).toBeDefined();
  });

  it('reaches as far as its scope does: the digital one fills the canvas, the analog one is round', () => {
    expect(SCOPE_MODES_BY_ID.digital.extent).toBe('canvas');
    expect(SCOPE_MODES_BY_ID.analog.extent).toBe('rangeCircle');
  });

  it('gives every mode a distinct label and a working renderer factory', () => {
    expect(new Set(SCOPE_MODES.map((mode) => mode.label)).size).toBe(SCOPE_MODES.length);
    for (const mode of SCOPE_MODES) {
      const first = mode.createRenderer();
      expect(first.render).toBeTypeOf('function');
      expect(mode.createRenderer()).not.toBe(first);
    }
  });

  it('writes every canvas color as six-digit hex, so translucent variants can be derived', () => {
    for (const mode of SCOPE_MODES) {
      for (const color of Object.values(mode.theme.canvas)) {
        expect(isHexColor(color)).toBe(true);
      }
    }
  });

  it('keeps setting hotkeys lowercase, distinct within a mode, and clear of the global keys', () => {
    const reserved = [
      MODE_HOTKEY,
      CONTROLS_HOTKEY,
      SELECT_NEXT_HOTKEY,
      SELECT_PREVIOUS_HOTKEY,
      ...RANGE_KEYS.in,
      ...RANGE_KEYS.out,
    ];
    expect(new Set(reserved).size).toBe(reserved.length);
    for (const mode of SCOPE_MODES) {
      const hotkeys = mode.settings.map((setting) => setting.hotkey);
      expect(new Set(hotkeys).size).toBe(hotkeys.length);
      for (const hotkey of hotkeys) {
        expect(hotkey).toBe(hotkey.toLowerCase());
        expect(reserved).not.toContain(hotkey);
      }
    }
  });
});

describe('nextScopeMode', () => {
  it('steps through the modes in order and wraps around', () => {
    expect(nextScopeMode('digital').id).toBe('analog');
    expect(nextScopeMode('analog').id).toBe('digital');
  });

  it('visits every mode exactly once per cycle', () => {
    const visited = [DEFAULT_SCOPE_MODE_ID];
    let current = nextScopeMode(DEFAULT_SCOPE_MODE_ID).id;
    while (current !== DEFAULT_SCOPE_MODE_ID) {
      visited.push(current);
      current = nextScopeMode(current).id;
    }

    expect(visited.sort()).toEqual([...SCOPE_MODE_IDS].sort());
  });
});
