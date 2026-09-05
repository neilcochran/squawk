import { describe, expect, it } from 'vitest';

import type { Aircraft } from '@squawk/types';

import { findSelectedIndex, moveSelection } from './selection.js';

function makeAircraft(icaoHex: string): Aircraft {
  return { icaoHex, lastSeenAt: 0 };
}

const AIRCRAFT: Aircraft[] = [makeAircraft('A0'), makeAircraft('B0'), makeAircraft('C0')];

describe('findSelectedIndex', () => {
  it('returns -1 when nothing is selected', () => {
    expect(findSelectedIndex(AIRCRAFT, undefined)).toBe(-1);
  });

  it('returns -1 when the selected hex is not present', () => {
    expect(findSelectedIndex(AIRCRAFT, 'ZZZZZZ')).toBe(-1);
  });

  it('returns the index of the selected aircraft', () => {
    expect(findSelectedIndex(AIRCRAFT, 'B0')).toBe(1);
  });
});

describe('moveSelection', () => {
  it('returns undefined for an empty list', () => {
    expect(moveSelection([], undefined, 1)).toBeUndefined();
  });

  it('selects the first row when nothing was selected', () => {
    expect(moveSelection(AIRCRAFT, undefined, 1)).toBe('A0');
    expect(moveSelection(AIRCRAFT, undefined, -1)).toBe('A0');
  });

  it('moves down to the next row', () => {
    expect(moveSelection(AIRCRAFT, 'A0', 1)).toBe('B0');
  });

  it('moves up to the previous row', () => {
    expect(moveSelection(AIRCRAFT, 'C0', -1)).toBe('B0');
  });

  it('clamps at the last row rather than wrapping', () => {
    expect(moveSelection(AIRCRAFT, 'C0', 1)).toBe('C0');
  });

  it('clamps at the first row rather than wrapping', () => {
    expect(moveSelection(AIRCRAFT, 'A0', -1)).toBe('A0');
  });

  it('falls back to the first row when the current selection is no longer present', () => {
    expect(moveSelection(AIRCRAFT, 'ZZZZZZ', 1)).toBe('A0');
  });
});
