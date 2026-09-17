import { describe, expect, it } from 'vitest';

import {
  isFreshRow,
  isStaleRow,
  NEW_HIGHLIGHT_MS,
  rowTextStyle,
  STALE_DIM_FRACTION,
} from './row-style.js';
import type { RowStyleFlags } from './row-style.js';

function flags(overrides: Partial<RowStyleFlags> = {}): RowStyleFlags {
  return {
    emergency: false,
    selected: false,
    watched: false,
    fresh: false,
    stale: false,
    ...overrides,
  };
}

describe('isFreshRow', () => {
  it('is true within the highlight window of first being tracked', () => {
    expect(isFreshRow(10_000, 10_000 + NEW_HIGHLIGHT_MS - 1)).toBe(true);
  });

  it('is false once the window has elapsed or the first-seen time is unknown', () => {
    expect(isFreshRow(10_000, 10_000 + NEW_HIGHLIGHT_MS)).toBe(false);
    expect(isFreshRow(undefined, 10_000)).toBe(false);
  });
});

describe('isStaleRow', () => {
  it('is true once the dim fraction of the stale threshold has elapsed', () => {
    expect(isStaleRow(0, 60_000 * STALE_DIM_FRACTION, 60_000)).toBe(true);
    expect(isStaleRow(0, 60_000 * STALE_DIM_FRACTION - 1, 60_000)).toBe(false);
  });

  it('scales with the configured threshold', () => {
    expect(isStaleRow(0, 6_000, 10_000)).toBe(true);
    expect(isStaleRow(0, 6_000, 60_000)).toBe(false);
  });
});

describe('rowTextStyle', () => {
  it('returns no props for a plain row', () => {
    expect(rowTextStyle(flags())).toEqual({});
  });

  it('renders an emergency row bold red regardless of the other flags', () => {
    expect(
      rowTextStyle(flags({ emergency: true, selected: true, watched: true, fresh: true })),
    ).toEqual({ color: 'red', bold: true });
  });

  it('renders the cursor row in explicit black, bold when watched', () => {
    expect(rowTextStyle(flags({ selected: true }))).toEqual({ color: '#000000' });
    expect(rowTextStyle(flags({ selected: true, watched: true }))).toEqual({
      color: '#000000',
      bold: true,
    });
    expect(rowTextStyle(flags({ selected: true, fresh: true }))).toEqual({ color: '#000000' });
  });

  it('renders a watched row bold yellow, beating the new-row green', () => {
    expect(rowTextStyle(flags({ watched: true }))).toEqual({ color: 'yellow', bold: true });
    expect(rowTextStyle(flags({ watched: true, fresh: true }))).toEqual({
      color: 'yellow',
      bold: true,
    });
  });

  it('renders a newly tracked row green', () => {
    expect(rowTextStyle(flags({ fresh: true }))).toEqual({ color: 'green' });
  });

  it('dims a stale row on top of its other style, except on the cursor row', () => {
    expect(rowTextStyle(flags({ stale: true }))).toEqual({ dimColor: true });
    expect(rowTextStyle(flags({ stale: true, watched: true }))).toEqual({
      color: 'yellow',
      bold: true,
      dimColor: true,
    });
    expect(rowTextStyle(flags({ stale: true, emergency: true }))).toEqual({
      color: 'red',
      bold: true,
      dimColor: true,
    });
    expect(rowTextStyle(flags({ stale: true, selected: true }))).toEqual({ color: '#000000' });
  });

  it('never sets a prop to undefined', () => {
    for (const style of [
      rowTextStyle(flags()),
      rowTextStyle(flags({ stale: true })),
      rowTextStyle(flags({ fresh: true })),
    ]) {
      expect(Object.values(style).every((value) => value !== undefined)).toBe(true);
    }
  });
});
