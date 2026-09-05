import { describe, expect, it } from 'vitest';

import type { Aircraft } from '@squawk/types';

import { findMatchIcaoHex, matchesSearch } from './search.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

describe('matchesSearch', () => {
  it('matches a substring of the ICAO hex, case-insensitively', () => {
    expect(matchesSearch(makeAircraft({ icaoHex: 'A0B1C2' }), 'a0b1')).toBe(true);
  });

  it('matches a substring of the callsign', () => {
    expect(matchesSearch(makeAircraft({ callsign: 'UAL123' }), 'ual')).toBe(true);
  });

  it('matches a substring of the squawk', () => {
    expect(matchesSearch(makeAircraft({ squawk: '7700' }), '770')).toBe(true);
  });

  it('does not match when the query appears in none of the fields', () => {
    expect(matchesSearch(makeAircraft({ callsign: 'UAL123', squawk: '1200' }), 'dal')).toBe(false);
  });

  it('never matches an empty or whitespace-only query', () => {
    expect(matchesSearch(makeAircraft(), '')).toBe(false);
    expect(matchesSearch(makeAircraft(), '   ')).toBe(false);
  });

  it('does not match against an unset callsign or squawk', () => {
    expect(matchesSearch(makeAircraft(), 'ual')).toBe(false);
  });
});

describe('findMatchIcaoHex', () => {
  const aircraft: Aircraft[] = [
    makeAircraft({ icaoHex: 'A0', callsign: 'UAL111' }),
    makeAircraft({ icaoHex: 'B0', callsign: 'DAL222' }),
    makeAircraft({ icaoHex: 'C0', callsign: 'UAL333' }),
  ];

  it('returns undefined when nothing matches', () => {
    expect(findMatchIcaoHex(aircraft, 'zzz', undefined, 1)).toBeUndefined();
  });

  it('finds the first match when nothing is currently selected', () => {
    expect(findMatchIcaoHex(aircraft, 'ual', undefined, 1)).toBe('A0');
  });

  it('searches forward from the current selection, skipping it', () => {
    expect(findMatchIcaoHex(aircraft, 'ual', 'A0', 1)).toBe('C0');
  });

  it('wraps around to the first match when searching forward past the end', () => {
    expect(findMatchIcaoHex(aircraft, 'ual', 'C0', 1)).toBe('A0');
  });

  it('searches backward from the current selection', () => {
    expect(findMatchIcaoHex(aircraft, 'ual', 'C0', -1)).toBe('A0');
  });

  it('wraps around to the last match when searching backward past the start', () => {
    expect(findMatchIcaoHex(aircraft, 'ual', 'A0', -1)).toBe('C0');
  });
});
