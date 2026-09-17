import { describe, expect, it } from 'vitest';

import type { Aircraft } from '@squawk/types';

import { matchesWatchlist, parseWatchlist } from './watchlist.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

describe('parseWatchlist', () => {
  it('splits on commas, trims, upper-cases, and drops duplicates and blanks', () => {
    expect(parseWatchlist(' a0b1c2, n12345 ,ual,, UAL ')).toEqual({
      terms: ['A0B1C2', 'N12345', 'UAL'],
    });
  });

  it('rejects a list with no terms', () => {
    const result = parseWatchlist(' , ');
    expect('message' in result).toBe(true);
    if ('message' in result) {
      expect(result.message).toContain('--watch needs at least one');
    }
  });
});

describe('matchesWatchlist', () => {
  it('matches an exact ICAO hex regardless of case', () => {
    expect(matchesWatchlist(makeAircraft({ icaoHex: 'a0b1c2' }), ['A0B1C2'])).toBe(true);
    expect(matchesWatchlist(makeAircraft({ icaoHex: 'A0B1C3' }), ['A0B1C2'])).toBe(false);
  });

  it('does not treat a hex term as a prefix of a longer hex', () => {
    expect(matchesWatchlist(makeAircraft({ icaoHex: 'A0B1C2' }), ['A0B1'])).toBe(false);
  });

  it('matches an exact resolved N-number', () => {
    const aircraft = makeAircraft({ registration: { icaoHex: 'A0B1C2', registration: 'N12345' } });
    expect(matchesWatchlist(aircraft, ['N12345'])).toBe(true);
    expect(matchesWatchlist(aircraft, ['N1234'])).toBe(false);
    expect(matchesWatchlist(makeAircraft(), ['N12345'])).toBe(false);
  });

  it('matches a callsign prefix', () => {
    const aircraft = makeAircraft({ callsign: 'UAL123' });
    expect(matchesWatchlist(aircraft, ['UAL'])).toBe(true);
    expect(matchesWatchlist(aircraft, ['UAL123'])).toBe(true);
    expect(matchesWatchlist(aircraft, ['AL1'])).toBe(false);
    expect(matchesWatchlist(makeAircraft(), ['UAL'])).toBe(false);
  });

  it('matches when any term matches', () => {
    const aircraft = makeAircraft({ callsign: 'DAL456' });
    expect(matchesWatchlist(aircraft, ['UAL', 'DAL'])).toBe(true);
  });

  it('never matches with an empty watchlist', () => {
    expect(matchesWatchlist(makeAircraft({ callsign: 'UAL123' }), [])).toBe(false);
  });
});
