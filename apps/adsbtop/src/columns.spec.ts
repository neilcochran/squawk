import { describe, expect, it } from 'vitest';

import type { Aircraft, Coordinates } from '@squawk/types';

import {
  autoFitColumns,
  availableColumns,
  COLUMNS,
  compareAircraft,
  findColumnByName,
  minimalColumnKeys,
  nextSortKey,
  parseColumnList,
  selectColumns,
  sortAircraft,
  sortKeyCycle,
  TABLE_CHROME_WIDTH,
  tableRowWidth,
} from './columns.js';
import type { ColumnDef, ColumnKey, RenderContext, SortKey } from './columns.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

function column(key: ColumnKey): ColumnDef {
  const found = COLUMNS.find((candidate) => candidate.key === key);
  if (found === undefined) {
    throw new Error(`no column ${key}`);
  }
  return found;
}

function keysOf(columns: readonly ColumnDef[]): ColumnKey[] {
  return columns.map((candidate) => candidate.key);
}

const LOCATION: Coordinates = { lat: 0, lon: 0 };
const NO_LOCATION: RenderContext = { nowMs: 0, location: undefined };
const WITH_LOCATION: RenderContext = { nowMs: 0, location: LOCATION };

describe('COLUMNS', () => {
  it('gives every column a distinct key, header, and full name', () => {
    expect(new Set(keysOf(COLUMNS)).size).toBe(COLUMNS.length);
    expect(new Set(COLUMNS.map((candidate) => candidate.header)).size).toBe(COLUMNS.length);
    expect(new Set(COLUMNS.map((candidate) => candidate.name)).size).toBe(COLUMNS.length);
  });

  it('marks only Dist, Brg, and CPA as needing a location', () => {
    expect(keysOf(COLUMNS.filter((candidate) => candidate.requiresLocation))).toEqual([
      'distance',
      'bearing',
      'closestApproach',
    ]);
  });

  it('renders the N-number in the registration column when present', () => {
    const aircraft = makeAircraft({ registration: { icaoHex: 'A0B1C2', registration: 'N12345' } });
    expect(column('registration').render(aircraft, NO_LOCATION)).toBe('N12345');
    expect(column('registration').render(makeAircraft(), NO_LOCATION)).toBe('-');
  });

  it('renders the age column relative to the context time', () => {
    expect(
      column('age').render(makeAircraft({ lastSeenAt: 0 }), { ...NO_LOCATION, nowMs: 45_000 }),
    ).toBe('45s');
  });

  it('renders the distance and bearing columns from the context location', () => {
    const aircraft = makeAircraft({ position: { lat: 1, lon: 0 } });
    expect(column('distance').render(aircraft, WITH_LOCATION)).toBe('60nm');
    expect(column('bearing').render(aircraft, WITH_LOCATION)).toBe('0°');
  });

  it('renders the closest approach column from the context location', () => {
    const aircraft = makeAircraft({
      position: { lat: 1, lon: 0 },
      trueTrackDeg: 180,
      groundSpeedKt: 120,
    });
    expect(column('closestApproach').render(aircraft, WITH_LOCATION)).toBe('0.0nm in 30m01s');
    expect(column('closestApproach').render(makeAircraft(), WITH_LOCATION)).toBe('-');
  });

  it('renders a placeholder in the location columns without a location', () => {
    const aircraft = makeAircraft({
      position: { lat: 1, lon: 0 },
      trueTrackDeg: 180,
      groundSpeedKt: 120,
    });
    expect(column('distance').render(aircraft, NO_LOCATION)).toBe('-');
    expect(column('bearing').render(aircraft, NO_LOCATION)).toBe('-');
    expect(column('closestApproach').render(aircraft, NO_LOCATION)).toBe('-');
  });
});

describe('availableColumns', () => {
  it('omits the location columns without a location', () => {
    const available = availableColumns(undefined);
    expect(available).toHaveLength(COLUMNS.length - 3);
    expect(available.some((candidate) => candidate.requiresLocation)).toBe(false);
  });

  it('includes every column when a location is configured', () => {
    expect(availableColumns(LOCATION)).toEqual(COLUMNS);
  });
});

describe('tableRowWidth', () => {
  it('sums the column widths plus a separator between each pair', () => {
    expect(tableRowWidth([column('icaoHex'), column('callsign')])).toBe(6 + 3 + 10);
  });

  it('is zero for no columns and just the width for one', () => {
    expect(tableRowWidth([])).toBe(0);
    expect(tableRowWidth([column('icaoHex')])).toBe(6);
  });
});

describe('autoFitColumns', () => {
  const all = availableColumns(LOCATION);

  it('keeps every column when they fit', () => {
    const width = tableRowWidth(all) + TABLE_CHROME_WIDTH;
    expect(autoFitColumns(all, width)).toEqual(all);
  });

  it('drops Grnd first when one column too wide', () => {
    const width = tableRowWidth(all) + TABLE_CHROME_WIDTH - 1;
    expect(keysOf(autoFitColumns(all, width))).toEqual(
      keysOf(all).filter((key) => key !== 'onGround'),
    );
  });

  it('drops columns least valuable first until the row fits', () => {
    const fitted = autoFitColumns(all, 100);
    expect(keysOf(fitted)).toEqual([
      'icaoHex',
      'callsign',
      'squawk',
      'altitude',
      'groundSpeed',
      'heading',
      'age',
      'distance',
      'closestApproach',
    ]);
    expect(tableRowWidth(fitted) + TABLE_CHROME_WIDTH).toBeLessThanOrEqual(100);
  });

  it('preserves display order after dropping', () => {
    const fitted = autoFitColumns(all, 60);
    const order = keysOf(COLUMNS);
    const indexes = keysOf(fitted).map((key) => order.indexOf(key));
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it('never drops the ICAO column, even when nothing fits', () => {
    expect(keysOf(autoFitColumns(all, 1))).toEqual(['icaoHex']);
  });

  it('only drops from the columns it is given', () => {
    const minimal = selectColumns(all, minimalColumnKeys());
    expect(keysOf(autoFitColumns(minimal, 30))).toEqual(['icaoHex', 'callsign']);
  });
});

describe('selectColumns', () => {
  it('returns the requested columns in display order regardless of key order', () => {
    const selected = selectColumns(COLUMNS, ['age', 'icaoHex', 'altitude']);
    expect(keysOf(selected)).toEqual(['icaoHex', 'altitude', 'age']);
  });

  it('ignores keys that are not available', () => {
    const selected = selectColumns(availableColumns(undefined), ['icaoHex', 'distance']);
    expect(keysOf(selected)).toEqual(['icaoHex']);
  });
});

describe('minimalColumnKeys', () => {
  it('is the narrow-terminal preset in display order', () => {
    expect(minimalColumnKeys()).toEqual(['icaoHex', 'callsign', 'squawk', 'altitude', 'age']);
  });
});

describe('findColumnByName', () => {
  it('matches the header text case-insensitively, ignoring surrounding whitespace', () => {
    expect(findColumnByName('cpa')?.key).toBe('closestApproach');
    expect(findColumnByName(' Callsign ')?.key).toBe('callsign');
    expect(findColumnByName('GRND')?.key).toBe('onGround');
  });

  it('returns undefined for a name that is not a header', () => {
    expect(findColumnByName('icaoHex')).toBeUndefined();
    expect(findColumnByName('bearing')).toBeUndefined();
  });
});

describe('parseColumnList', () => {
  it('parses comma-separated header names into keys in the order given', () => {
    expect(parseColumnList('cpa, icao,Alt')).toEqual({
      keys: ['closestApproach', 'icaoHex', 'altitude'],
    });
  });

  it('rejects an unknown name and lists the valid ones', () => {
    const result = parseColumnList('icao,bogus');
    expect('message' in result).toBe(true);
    if ('message' in result) {
      expect(result.message).toContain('Unknown column "bogus"');
      expect(result.message).toContain('ICAO, Callsign, Reg');
    }
  });

  it('rejects a duplicate name', () => {
    const result = parseColumnList('icao,alt,ICAO');
    expect('message' in result).toBe(true);
    if ('message' in result) {
      expect(result.message).toContain('Duplicate column "ICAO"');
    }
  });

  it('rejects an empty list', () => {
    const result = parseColumnList(' , ');
    expect('message' in result).toBe(true);
    if ('message' in result) {
      expect(result.message).toContain('at least one column name');
    }
  });
});

describe('sortKeyCycle', () => {
  it('covers every visible column except Grnd, in display order', () => {
    expect(sortKeyCycle(availableColumns(undefined))).toEqual([
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

  it('follows the visible set, including the location columns when shown', () => {
    const shown = selectColumns(COLUMNS, ['icaoHex', 'onGround', 'bearing', 'closestApproach']);
    expect(sortKeyCycle(shown)).toEqual(['icaoHex', 'bearing', 'closestApproach']);
  });
});

describe('nextSortKey', () => {
  const cycle = sortKeyCycle(availableColumns(undefined));

  it('cycles forward through every sort key back to the start', () => {
    const start: SortKey = 'icaoHex';
    let current: SortKey = start;
    const seen: SortKey[] = [current];
    for (let i = 0; i < cycle.length - 1; i++) {
      current = nextSortKey(current, cycle, 1);
      seen.push(current);
    }
    expect(nextSortKey(current, cycle, 1)).toBe(start);
    expect(new Set(seen).size).toBe(cycle.length);
  });

  it('cycles backward, wrapping from the first key to the last', () => {
    expect(nextSortKey('callsign', cycle, -1)).toBe('icaoHex');
    expect(nextSortKey('icaoHex', cycle, -1)).toBe('age');
  });

  it('steps to the first key when the current one is not in the cycle', () => {
    expect(nextSortKey('distance', cycle, 1)).toBe('icaoHex');
    expect(nextSortKey('distance', cycle, -1)).toBe('icaoHex');
  });

  it('returns the current key when the cycle is empty', () => {
    expect(nextSortKey('age', [], 1)).toBe('age');
  });
});

describe('compareAircraft', () => {
  it('sorts by icaoHex lexicographically', () => {
    const a = makeAircraft({ icaoHex: 'A00000' });
    const b = makeAircraft({ icaoHex: 'B00000' });
    expect(compareAircraft(a, b, 'icaoHex', 'asc', undefined)).toBeLessThan(0);
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
    const a = makeAircraft();
    const b = makeAircraft({ icaoHex: 'D3E4F5' });
    expect(compareAircraft(a, b, 'callsign', 'asc', undefined)).toBe(0);
  });

  it('sorts by altitude, preferring barometric over geometric', () => {
    const low = makeAircraft({
      position: { lat: 0, lon: 0, baroAltitudeFt: 1000, geoAltitudeFt: 9000 },
    });
    const high = makeAircraft({
      icaoHex: 'D3E4F5',
      position: { lat: 0, lon: 0, geoAltitudeFt: 5000 },
    });
    expect(compareAircraft(low, high, 'altitude', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts aircraft with a known altitude before those without one', () => {
    const known = makeAircraft({ position: { lat: 0, lon: 0, baroAltitudeFt: 1000 } });
    const unknown = makeAircraft({ icaoHex: 'D3E4F5' });
    expect(compareAircraft(known, unknown, 'altitude', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts by ground speed, slowest first', () => {
    const slow = makeAircraft({ groundSpeedKt: 100 });
    const fast = makeAircraft({ icaoHex: 'D3E4F5', groundSpeedKt: 400 });
    expect(compareAircraft(slow, fast, 'groundSpeed', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts by age with the most recently seen first', () => {
    const recent = makeAircraft({ lastSeenAt: 10_000 });
    const stale = makeAircraft({ icaoHex: 'D3E4F5', lastSeenAt: 1_000 });
    expect(compareAircraft(recent, stale, 'age', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts by registration N-number, with unregistered aircraft last', () => {
    const a = makeAircraft({ registration: { icaoHex: 'A0B1C2', registration: 'N100AB' } });
    const b = makeAircraft({
      icaoHex: 'D3E4F5',
      registration: { icaoHex: 'D3E4F5', registration: 'N200CD' },
    });
    const none = makeAircraft({ icaoHex: 'E5F6A7' });
    expect(compareAircraft(a, b, 'registration', 'asc', undefined)).toBeLessThan(0);
    expect(compareAircraft(none, a, 'registration', 'asc', undefined)).toBeGreaterThan(0);
  });

  it('sorts by squawk code lexicographically', () => {
    const a = makeAircraft({ squawk: '1200' });
    const b = makeAircraft({ icaoHex: 'D3E4F5', squawk: '7700' });
    expect(compareAircraft(a, b, 'squawk', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts by heading, preferring true track over magnetic heading', () => {
    const a = makeAircraft({ trueTrackDeg: 90, magneticHeadingDeg: 350 });
    const b = makeAircraft({ icaoHex: 'D3E4F5', magneticHeadingDeg: 180 });
    expect(compareAircraft(a, b, 'heading', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts by vertical rate, descending aircraft first', () => {
    const descending = makeAircraft({ verticalRateFtPerMin: -800 });
    const climbing = makeAircraft({ icaoHex: 'D3E4F5', verticalRateFtPerMin: 1200 });
    expect(compareAircraft(descending, climbing, 'verticalRate', 'asc', undefined)).toBeLessThan(0);
  });

  it('sorts by distance and bearing from the configured location', () => {
    const near = makeAircraft({ position: { lat: 0, lon: 1 } });
    const far = makeAircraft({ icaoHex: 'D3E4F5', position: { lat: 0, lon: 2 } });
    const north = makeAircraft({ icaoHex: 'E5F6A7', position: { lat: 1, lon: 0 } });
    expect(compareAircraft(near, far, 'distance', 'asc', LOCATION)).toBeLessThan(0);
    expect(compareAircraft(north, near, 'bearing', 'asc', LOCATION)).toBeLessThan(0);
  });

  it('sorts by closest approach distance, nearest pass first', () => {
    const overhead = makeAircraft({
      position: { lat: 1, lon: 0 },
      trueTrackDeg: 180,
      groundSpeedKt: 120,
    });
    const abeam = makeAircraft({
      icaoHex: 'D3E4F5',
      position: { lat: 0, lon: 1 },
      trueTrackDeg: 0,
      groundSpeedKt: 120,
    });
    const opening = makeAircraft({
      icaoHex: 'E5F6A7',
      position: { lat: 0, lon: 1 },
      trueTrackDeg: 90,
      groundSpeedKt: 120,
    });
    expect(compareAircraft(overhead, abeam, 'closestApproach', 'asc', LOCATION)).toBeLessThan(0);
    expect(compareAircraft(abeam, opening, 'closestApproach', 'asc', LOCATION)).toBeLessThan(0);
    expect(compareAircraft(abeam, opening, 'closestApproach', 'desc', LOCATION)).toBeLessThan(0);
  });

  it('treats every aircraft as unordered on the location keys without a location', () => {
    const near = makeAircraft({
      position: { lat: 0, lon: 1 },
      trueTrackDeg: 270,
      groundSpeedKt: 60,
    });
    const far = makeAircraft({ icaoHex: 'D3E4F5', position: { lat: 0, lon: 2 } });
    expect(compareAircraft(near, far, 'distance', 'asc', undefined)).toBe(0);
    expect(compareAircraft(near, far, 'bearing', 'desc', undefined)).toBe(0);
    expect(compareAircraft(near, far, 'closestApproach', 'asc', undefined)).toBe(0);
  });

  it('reverses the order of aircraft that have the field when descending', () => {
    const slow = makeAircraft({ groundSpeedKt: 100 });
    const fast = makeAircraft({ icaoHex: 'D3E4F5', groundSpeedKt: 400 });
    expect(compareAircraft(slow, fast, 'groundSpeed', 'desc', undefined)).toBeGreaterThan(0);
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
    expect(sorted.map((aircraft) => aircraft.icaoHex)).toEqual(['A00000', 'B00000']);
    expect(input.map((aircraft) => aircraft.icaoHex)).toEqual(['B00000', 'A00000']);
  });

  it('sorts descending when asked', () => {
    const input = [makeAircraft({ icaoHex: 'A00000' }), makeAircraft({ icaoHex: 'B00000' })];
    const sorted = sortAircraft(input, 'icaoHex', 'desc', undefined);
    expect(sorted.map((aircraft) => aircraft.icaoHex)).toEqual(['B00000', 'A00000']);
  });
});
