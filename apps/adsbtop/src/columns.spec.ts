import { describe, expect, it } from 'vitest';

import type { Aircraft, Coordinates } from '@squawk/types';

import {
  buildBearingColumn,
  buildDistanceColumn,
  COLUMNS,
  compareAircraft,
  nextSortKey,
  sortAircraft,
  sortKeyCycle,
  visibleColumns,
} from './columns.js';
import type { SortKey } from './columns.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

describe('COLUMNS registration column', () => {
  const registrationColumn = COLUMNS.find((column) => column.key === 'registration');

  it('is part of the full column set but not the compact set', () => {
    expect(registrationColumn?.compact).toBe(false);
  });

  it('renders the N-number when present', () => {
    const aircraft = makeAircraft({ registration: { icaoHex: 'A0B1C2', registration: 'N12345' } });
    expect(registrationColumn?.render(aircraft, 0)).toBe('N12345');
  });

  it('renders a placeholder when unresolved', () => {
    expect(registrationColumn?.render(makeAircraft(), 0)).toBe('-');
  });
});

describe('buildDistanceColumn', () => {
  const location: Coordinates = { lat: 0, lon: 0 };
  const column = buildDistanceColumn(location);

  it('is not part of the compact set', () => {
    expect(column.compact).toBe(false);
  });

  it('renders the distance to a positioned aircraft', () => {
    const aircraft: Aircraft = { icaoHex: 'A0B1C2', lastSeenAt: 0, position: { lat: 1, lon: 0 } };
    expect(column.render(aircraft, 0)).toBe('60nm');
  });

  it('renders a placeholder when the aircraft has no position', () => {
    expect(column.render({ icaoHex: 'A0B1C2', lastSeenAt: 0 }, 0)).toBe('-');
  });
});

describe('buildBearingColumn', () => {
  const location: Coordinates = { lat: 0, lon: 0 };
  const column = buildBearingColumn(location);

  it('is not part of the compact set', () => {
    expect(column.compact).toBe(false);
  });

  it('renders the bearing to a positioned aircraft', () => {
    const aircraft: Aircraft = { icaoHex: 'A0B1C2', lastSeenAt: 0, position: { lat: 0, lon: 1 } };
    expect(column.render(aircraft, 0)).toBe('90°');
  });

  it('renders a placeholder when the aircraft has no position', () => {
    expect(column.render({ icaoHex: 'A0B1C2', lastSeenAt: 0 }, 0)).toBe('-');
  });
});

describe('visibleColumns', () => {
  it('returns every column when not compact and no location is configured', () => {
    expect(visibleColumns(false)).toHaveLength(COLUMNS.length);
  });

  it('returns only compact-flagged columns when compact, regardless of location', () => {
    const columns = visibleColumns(true, { lat: 0, lon: 0 });
    expect(columns.length).toBeGreaterThan(0);
    expect(columns.every((column) => column.compact)).toBe(true);
  });

  it('appends Dist/Brg columns when a location is configured and not compact', () => {
    const columns = visibleColumns(false, { lat: 0, lon: 0 });
    expect(columns).toHaveLength(COLUMNS.length + 2);
    expect(columns.map((column) => column.key).slice(-2)).toEqual(['distance', 'bearing']);
  });
});

describe('sortKeyCycle', () => {
  it('covers every column except Grnd, in display order, without a location', () => {
    expect(sortKeyCycle(undefined)).toEqual([
      'icaoHex',
      'callsign',
      'registration',
      'squawk',
      'altitude',
      'groundSpeed',
      'heading',
      'verticalRate',
      'age',
    ]);
  });

  it('appends distance and bearing when a location is configured', () => {
    const cycle = sortKeyCycle({ lat: 0, lon: 0 });
    expect(cycle.slice(-2)).toEqual(['distance', 'bearing']);
    expect(cycle.length).toBe(sortKeyCycle(undefined).length + 2);
  });
});

describe('nextSortKey', () => {
  it('cycles forward through every sort key back to the start', () => {
    const start: SortKey = 'icaoHex';
    let current: SortKey = start;
    const seen: SortKey[] = [current];
    for (let i = 0; i < 8; i++) {
      current = nextSortKey(current, undefined, 1);
      seen.push(current);
    }
    expect(nextSortKey(current, undefined, 1)).toBe(start);
    expect(new Set(seen).size).toBe(9);
  });

  it('cycles backward, wrapping from the first key to the last', () => {
    expect(nextSortKey('callsign', undefined, -1)).toBe('icaoHex');
    expect(nextSortKey('icaoHex', undefined, -1)).toBe('age');
  });

  it('includes distance and bearing in the cycle only when a location is configured', () => {
    const location: Coordinates = { lat: 0, lon: 0 };
    expect(nextSortKey('age', undefined, 1)).toBe('icaoHex');
    expect(nextSortKey('age', location, 1)).toBe('distance');
    expect(nextSortKey('distance', location, 1)).toBe('bearing');
    expect(nextSortKey('bearing', location, 1)).toBe('icaoHex');
    expect(nextSortKey('icaoHex', location, -1)).toBe('bearing');
  });
});

describe('compareAircraft', () => {
  it('sorts by icaoHex lexicographically', () => {
    const a = makeAircraft({ icaoHex: 'B00000' });
    const b = makeAircraft({ icaoHex: 'A00000' });
    expect(compareAircraft(a, b, 'icaoHex', 'asc', undefined)).toBeGreaterThan(0);
  });

  it('sorts aircraft with a callsign before those without one', () => {
    const withCallsign = makeAircraft({ callsign: 'UAL123' });
    const withoutCallsign = makeAircraft({ icaoHex: 'D3E4F5' });
    expect(
      compareAircraft(withCallsign, withoutCallsign, 'callsign', 'asc', undefined),
    ).toBeLessThan(0);
    expect(
      compareAircraft(withoutCallsign, withCallsign, 'callsign', 'asc', undefined),
    ).toBeGreaterThan(0);
  });

  it('treats two aircraft with no callsign as equivalent', () => {
    expect(
      compareAircraft(
        makeAircraft(),
        makeAircraft({ icaoHex: 'D3E4F5' }),
        'callsign',
        'asc',
        undefined,
      ),
    ).toBe(0);
  });

  it('sorts by altitude, preferring barometric over geometric', () => {
    const low = makeAircraft({ position: { lat: 0, lon: 0, baroAltitudeFt: 1000 } });
    const high = makeAircraft({
      icaoHex: 'D3E4F5',
      position: { lat: 0, lon: 0, geoAltitudeFt: 20000 },
    });
    expect(compareAircraft(low, high, 'altitude', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts aircraft with a known altitude before those without one', () => {
    const known = makeAircraft({ position: { lat: 0, lon: 0, baroAltitudeFt: 1000 } });
    const unknown = makeAircraft({ icaoHex: 'D3E4F5' });
    expect(compareAircraft(known, unknown, 'altitude', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts by ground speed, slowest first', () => {
    const slow = makeAircraft({ groundSpeedKt: 120 });
    const fast = makeAircraft({ icaoHex: 'D3E4F5', groundSpeedKt: 450 });
    expect(compareAircraft(slow, fast, 'groundSpeed', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts aircraft with a known ground speed before those without one', () => {
    const known = makeAircraft({ groundSpeedKt: 120 });
    const unknown = makeAircraft({ icaoHex: 'D3E4F5' });
    expect(compareAircraft(known, unknown, 'groundSpeed', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts by age with the most recently seen first', () => {
    const recent = makeAircraft({ lastSeenAt: 2000 });
    const stale = makeAircraft({ icaoHex: 'D3E4F5', lastSeenAt: 1000 });
    expect(compareAircraft(recent, stale, 'age', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts by registration N-number, with unregistered aircraft last', () => {
    const alpha = makeAircraft({ registration: { icaoHex: 'A0B1C2', registration: 'N100AA' } });
    const bravo = makeAircraft({
      icaoHex: 'D3E4F5',
      registration: { icaoHex: 'D3E4F5', registration: 'N200BB' },
    });
    const none = makeAircraft({ icaoHex: 'E5F6A7' });
    expect(compareAircraft(alpha, bravo, 'registration', 'asc', undefined)).toBeLessThan(0);
    expect(compareAircraft(none, alpha, 'registration', 'asc', undefined)).toBeGreaterThan(0);
  });

  it('sorts by squawk code lexicographically', () => {
    const low = makeAircraft({ squawk: '1200' });
    const high = makeAircraft({ icaoHex: 'D3E4F5', squawk: '7700' });
    expect(compareAircraft(low, high, 'squawk', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts by heading, preferring true track over magnetic heading', () => {
    const north = makeAircraft({ trueTrackDeg: 10, magneticHeadingDeg: 350 });
    const east = makeAircraft({ icaoHex: 'D3E4F5', magneticHeadingDeg: 90 });
    expect(compareAircraft(north, east, 'heading', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts by vertical rate, descending aircraft first', () => {
    const descending = makeAircraft({ verticalRateFtPerMin: -1000 });
    const climbing = makeAircraft({ icaoHex: 'D3E4F5', verticalRateFtPerMin: 1500 });
    expect(compareAircraft(descending, climbing, 'verticalRate', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts by distance and bearing from the configured location', () => {
    const location: Coordinates = { lat: 0, lon: 0 };
    const near = makeAircraft({ position: { lat: 0, lon: 1 } });
    const far = makeAircraft({ icaoHex: 'D3E4F5', position: { lat: 0, lon: 2 } });
    const north = makeAircraft({ icaoHex: 'E5F6A7', position: { lat: 1, lon: 0 } });
    expect(compareAircraft(near, far, 'distance', 'asc', location)).toBeLessThan(0);
    expect(compareAircraft(north, near, 'bearing', 'asc', location)).toBeLessThan(0);
  });

  it('treats every aircraft as unordered on distance/bearing without a location', () => {
    const near = makeAircraft({ position: { lat: 0, lon: 1 } });
    const far = makeAircraft({ icaoHex: 'D3E4F5', position: { lat: 0, lon: 2 } });
    expect(compareAircraft(near, far, 'distance', 'asc', undefined)).toBe(0);
    expect(compareAircraft(near, far, 'bearing', 'desc', undefined)).toBe(0);
  });

  it('reverses the order of aircraft that have the field when descending', () => {
    const slow = makeAircraft({ groundSpeedKt: 100 });
    const fast = makeAircraft({ icaoHex: 'D3E4F5', groundSpeedKt: 400 });
    expect(compareAircraft(slow, fast, 'groundSpeed', 'desc', undefined)).toBeGreaterThan(0);
    expect(compareAircraft(fast, slow, 'groundSpeed', 'desc', undefined)).toBeLessThan(0);
  });

  it('keeps aircraft missing the field at the bottom even when descending', () => {
    const known = makeAircraft({ groundSpeedKt: 100 });
    const unknown = makeAircraft({ icaoHex: 'D3E4F5' });
    expect(compareAircraft(known, unknown, 'groundSpeed', 'desc', undefined)).toBeLessThan(0);
    expect(compareAircraft(unknown, known, 'groundSpeed', 'desc', undefined)).toBeGreaterThan(0);
  });
});

describe('sortAircraft', () => {
  it('returns a new array sorted by the given key without mutating the input', () => {
    const input = [makeAircraft({ icaoHex: 'B00000' }), makeAircraft({ icaoHex: 'A00000' })];
    const sorted = sortAircraft(input, 'icaoHex', 'asc', undefined);

    expect(sorted.map((a) => a.icaoHex)).toEqual(['A00000', 'B00000']);
    expect(input.map((a) => a.icaoHex)).toEqual(['B00000', 'A00000']);
  });

  it('sorts descending when asked', () => {
    const input = [makeAircraft({ icaoHex: 'A00000' }), makeAircraft({ icaoHex: 'B00000' })];
    const sorted = sortAircraft(input, 'icaoHex', 'desc', undefined);

    expect(sorted.map((a) => a.icaoHex)).toEqual(['B00000', 'A00000']);
  });
});
