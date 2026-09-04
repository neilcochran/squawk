import { describe, expect, it } from 'vitest';

import type { Aircraft } from '@squawk/types';

import { COLUMNS, compareAircraft, nextSortKey, sortAircraft, visibleColumns } from './columns.js';
import type { SortKey } from './columns.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

describe('visibleColumns', () => {
  it('returns every column when not compact', () => {
    expect(visibleColumns(false)).toHaveLength(COLUMNS.length);
  });

  it('returns only compact-flagged columns when compact', () => {
    const columns = visibleColumns(true);
    expect(columns.length).toBeGreaterThan(0);
    expect(columns.every((column) => column.compact)).toBe(true);
  });
});

describe('nextSortKey', () => {
  it('cycles through every sort key back to the start', () => {
    const start: SortKey = 'icaoHex';
    let current: SortKey = start;
    const seen: SortKey[] = [current];
    for (let i = 0; i < 3; i++) {
      current = nextSortKey(current);
      seen.push(current);
    }
    expect(nextSortKey(current)).toBe(start);
    expect(new Set(seen).size).toBe(4);
  });
});

describe('compareAircraft', () => {
  it('sorts by icaoHex lexicographically', () => {
    const a = makeAircraft({ icaoHex: 'B00000' });
    const b = makeAircraft({ icaoHex: 'A00000' });
    expect(compareAircraft(a, b, 'icaoHex')).toBeGreaterThan(0);
  });

  it('sorts aircraft with a callsign before those without one', () => {
    const withCallsign = makeAircraft({ callsign: 'UAL123' });
    const withoutCallsign = makeAircraft({ icaoHex: 'D3E4F5' });
    expect(compareAircraft(withCallsign, withoutCallsign, 'callsign')).toBeLessThan(0);
    expect(compareAircraft(withoutCallsign, withCallsign, 'callsign')).toBeGreaterThan(0);
  });

  it('treats two aircraft with no callsign as equivalent', () => {
    expect(compareAircraft(makeAircraft(), makeAircraft({ icaoHex: 'D3E4F5' }), 'callsign')).toBe(
      0,
    );
  });

  it('sorts by altitude, preferring barometric over geometric', () => {
    const low = makeAircraft({ position: { lat: 0, lon: 0, baroAltitudeFt: 1000 } });
    const high = makeAircraft({
      icaoHex: 'D3E4F5',
      position: { lat: 0, lon: 0, geoAltitudeFt: 20000 },
    });
    expect(compareAircraft(low, high, 'altitude')).toBeLessThan(0);
  });

  it('sorts aircraft with a known altitude before those without one', () => {
    const known = makeAircraft({ position: { lat: 0, lon: 0, baroAltitudeFt: 1000 } });
    const unknown = makeAircraft({ icaoHex: 'D3E4F5' });
    expect(compareAircraft(known, unknown, 'altitude')).toBeLessThan(0);
  });

  it('sorts by age with the most recently seen first', () => {
    const recent = makeAircraft({ lastSeenAt: 2000 });
    const stale = makeAircraft({ icaoHex: 'D3E4F5', lastSeenAt: 1000 });
    expect(compareAircraft(recent, stale, 'age')).toBeLessThan(0);
  });
});

describe('sortAircraft', () => {
  it('returns a new array sorted by the given key without mutating the input', () => {
    const input = [makeAircraft({ icaoHex: 'B00000' }), makeAircraft({ icaoHex: 'A00000' })];
    const sorted = sortAircraft(input, 'icaoHex');

    expect(sorted.map((a) => a.icaoHex)).toEqual(['A00000', 'B00000']);
    expect(input.map((a) => a.icaoHex)).toEqual(['B00000', 'A00000']);
  });
});
