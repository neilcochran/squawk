import { describe, it, expect } from 'vitest';

import { fuzzySearch } from './search.js';
import type { SearchField } from './search.js';

interface Airport {
  faaId: string;
  name: string;
  visible: boolean;
}

const airports: Airport[] = [
  { faaId: 'JFK', name: 'John F Kennedy Intl', visible: true },
  { faaId: 'EWR', name: 'Newark Liberty Intl', visible: true },
  { faaId: 'LGA', name: 'LaGuardia', visible: false },
  { faaId: 'BOS', name: 'Boston Logan Intl', visible: true },
];

function keys(airport: Airport): SearchField[] {
  return [
    { name: 'faaId', text: airport.faaId },
    { name: 'name', text: airport.name },
  ];
}

describe('fuzzySearch', () => {
  it('returns an empty array for a blank query', () => {
    expect(fuzzySearch(airports, '', { keys })).toEqual([]);
    expect(fuzzySearch(airports, '   ', { keys })).toEqual([]);
  });

  it('ranks an exact identifier match first with the matched field reported', () => {
    const results = fuzzySearch(airports, 'jfk', { keys });
    expect(results[0]?.item.faaId).toBe('JFK');
    expect(results[0]?.score).toBe(1);
    expect(results[0]?.field).toBe('faaId');
    expect(results[0]?.ranges).toEqual([{ start: 0, end: 3 }]);
  });

  it('matches against a non-identifier field', () => {
    const results = fuzzySearch(airports, 'kennedy', { keys });
    expect(results[0]?.item.faaId).toBe('JFK');
    expect(results[0]?.field).toBe('name');
  });

  it('keeps the best-scoring field per item', () => {
    const results = fuzzySearch(airports, 'bos', { keys });
    expect(results[0]?.item.faaId).toBe('BOS');
    expect(results[0]?.field).toBe('faaId');
    expect(results[0]?.score).toBe(1);
  });

  it('honours the result limit', () => {
    const results = fuzzySearch(airports, 'intl', { keys, limit: 2 });
    expect(results).toHaveLength(2);
  });

  it('excludes items rejected by the filter predicate', () => {
    const visibleOnly = fuzzySearch(airports, 'guard', { keys, filter: (a) => a.visible });
    expect(visibleOnly).toEqual([]);

    const unfiltered = fuzzySearch(airports, 'guard', { keys });
    expect(unfiltered).toHaveLength(1);
    expect(unfiltered[0]?.item.faaId).toBe('LGA');
  });

  it('drops matches at or below minScore', () => {
    const kept = fuzzySearch(airports, 'lbty', { keys });
    expect(kept[0]?.item.faaId).toBe('EWR');

    const dropped = fuzzySearch(airports, 'lbty', { keys, minScore: 0.6 });
    expect(dropped).toEqual([]);
  });

  it('preserves input order for equal scores', () => {
    const towers: Airport[] = [
      { faaId: 'A', name: 'Tower', visible: true },
      { faaId: 'B', name: 'Tower', visible: true },
    ];
    const results = fuzzySearch(towers, 'tower', { keys });
    expect(results.map((result) => result.item.faaId)).toEqual(['A', 'B']);
  });

  it('defaults to a limit of 20', () => {
    const many: Airport[] = Array.from({ length: 30 }, (_unused, index) => ({
      faaId: `X${index}`,
      name: `Station ${index}`,
      visible: true,
    }));
    const results = fuzzySearch(many, 'station', { keys });
    expect(results).toHaveLength(20);
  });
});
