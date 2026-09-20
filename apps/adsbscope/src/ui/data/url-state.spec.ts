import { describe, expect, it } from 'vitest';

import { MAX_RANGE_NM } from '../../shared/protocol.js';

import { formatUrlSearch, parseUrlState } from './url-state.js';

const DEFAULTS = { modeId: 'digital', rangeNm: 60 } as const;

describe('parseUrlState', () => {
  it('asks for nothing when the URL has no query', () => {
    expect(parseUrlState('')).toEqual({
      modeId: undefined,
      rangeNm: undefined,
      selectedIcaoHex: undefined,
    });
  });

  it('reads the view style, range, and selection, with or without the leading question mark', () => {
    const expected = { modeId: 'analog', rangeNm: 40, selectedIcaoHex: 'a4ce45' };

    expect(parseUrlState('?mode=analog&range=40&selected=A4CE45')).toEqual(expected);
    expect(parseUrlState('mode=analog&range=40&selected=a4ce45')).toEqual(expected);
  });

  it('ignores a view style the scope does not have', () => {
    expect(parseUrlState('?mode=hologram').modeId).toBeUndefined();
  });

  it('ignores a range that is not a positive number of miles within the limit', () => {
    for (const range of ['0', '-5', 'far', '', String(MAX_RANGE_NM + 1), 'Infinity']) {
      expect(parseUrlState(`?range=${range}`).rangeNm).toBeUndefined();
    }
    expect(parseUrlState(`?range=${MAX_RANGE_NM}`).rangeNm).toBe(MAX_RANGE_NM);
    expect(parseUrlState('?range=12.5').rangeNm).toBe(12.5);
  });

  it('ignores a selection that is not a six-digit ICAO hex', () => {
    for (const selected of ['', 'a4ce4', 'a4ce456', 'zzzzzz', '<script>']) {
      expect(parseUrlState(`?selected=${encodeURIComponent(selected)}`).selectedIcaoHex).toBe(
        undefined,
      );
    }
  });
});

describe('formatUrlSearch', () => {
  it('writes nothing for an untouched scope, so its URL stays clean', () => {
    expect(
      formatUrlSearch({ modeId: 'digital', rangeNm: 60, selectedIcaoHex: undefined }, DEFAULTS),
    ).toBe('');
  });

  it('writes only what differs from what the scope would show anyway', () => {
    expect(
      formatUrlSearch({ modeId: 'analog', rangeNm: 60, selectedIcaoHex: undefined }, DEFAULTS),
    ).toBe('?mode=analog');
    expect(
      formatUrlSearch({ modeId: 'digital', rangeNm: 40, selectedIcaoHex: undefined }, DEFAULTS),
    ).toBe('?range=40');
    expect(
      formatUrlSearch({ modeId: 'digital', rangeNm: 60, selectedIcaoHex: 'a4ce45' }, DEFAULTS),
    ).toBe('?selected=a4ce45');
  });

  it('round-trips a fully changed view', () => {
    const state = { modeId: 'analog', rangeNm: 12.5, selectedIcaoHex: 'a4ce45' } as const;

    expect(parseUrlState(formatUrlSearch(state, DEFAULTS))).toEqual(state);
  });
});
