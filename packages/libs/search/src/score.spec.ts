import { describe, it, expect } from 'vitest';

import { fuzzyScore } from './score.js';

describe('fuzzyScore', () => {
  describe('exact match', () => {
    it('scores 1 for an identical string', () => {
      expect(fuzzyScore('jfk', 'jfk')).toEqual({ score: 1, ranges: [{ start: 0, end: 3 }] });
    });

    it('is case-insensitive', () => {
      expect(fuzzyScore('JFK', 'jfk')).toEqual({ score: 1, ranges: [{ start: 0, end: 3 }] });
      expect(fuzzyScore('jfk', 'JFK')).toEqual({ score: 1, ranges: [{ start: 0, end: 3 }] });
    });

    it('trims surrounding whitespace from the query', () => {
      expect(fuzzyScore('  jfk  ', 'JFK')).toEqual({ score: 1, ranges: [{ start: 0, end: 3 }] });
    });

    it('ranges span the full original candidate', () => {
      const result = fuzzyScore('kennedy', 'Kennedy');
      expect(result.score).toBe(1);
      expect(result.ranges).toEqual([{ start: 0, end: 7 }]);
    });
  });

  describe('prefix match', () => {
    it('scores in the prefix band with a leading range', () => {
      const result = fuzzyScore('ken', 'Kennedy');
      expect(result.score).toBeGreaterThanOrEqual(0.9);
      expect(result.score).toBeLessThan(1);
      expect(result.ranges).toEqual([{ start: 0, end: 3 }]);
    });

    it('rewards higher coverage', () => {
      const short = fuzzyScore('ken', 'kennedy').score;
      const long = fuzzyScore('kenned', 'kennedy').score;
      expect(long).toBeGreaterThan(short);
    });
  });

  describe('word-boundary prefix match', () => {
    it('scores in the word-prefix band and highlights the matched word', () => {
      const result = fuzzyScore('kennedy', 'John F Kennedy Intl');
      expect(result.score).toBeGreaterThanOrEqual(0.8);
      expect(result.score).toBeLessThan(0.9);
      expect(result.ranges).toEqual([{ start: 7, end: 14 }]);
    });

    it('prefers a word-boundary occurrence over an earlier mid-word one', () => {
      const result = fuzzyScore('ken', 'mckennedy ken field');
      expect(result.score).toBeGreaterThanOrEqual(0.8);
      expect(result.score).toBeLessThan(0.9);
      expect(result.ranges[0]?.start).toBe(10);
    });
  });

  describe('substring match', () => {
    it('scores in the substring band for a mid-word match', () => {
      const result = fuzzyScore('enn', 'Kennedy');
      expect(result.score).toBeGreaterThanOrEqual(0.65);
      expect(result.score).toBeLessThan(0.8);
      expect(result.ranges).toEqual([{ start: 1, end: 4 }]);
    });

    it('treats digits as word characters for boundary detection', () => {
      const result = fuzzyScore('cd', 'ab12cd');
      expect(result.score).toBeGreaterThanOrEqual(0.65);
      expect(result.score).toBeLessThan(0.8);
      expect(result.ranges).toEqual([{ start: 4, end: 6 }]);
    });
  });

  describe('subsequence match', () => {
    it('scores in the subsequence band and merges adjacent matched ranges', () => {
      const result = fuzzyScore('kndy', 'Kennedy');
      expect(result.score).toBeGreaterThanOrEqual(0.4);
      expect(result.score).toBeLessThan(0.65);
      expect(result.ranges).toEqual([
        { start: 0, end: 1 },
        { start: 2, end: 3 },
        { start: 5, end: 7 },
      ]);
    });
  });

  describe('typo match', () => {
    it('matches a single substitution within the typo band', () => {
      const result = fuzzyScore('jfx', 'JFK');
      expect(result.score).toBeGreaterThanOrEqual(0.3);
      expect(result.score).toBeLessThan(0.5);
      expect(result.ranges).toEqual([{ start: 0, end: 3 }]);
    });

    it('matches an adjacent transposition', () => {
      const result = fuzzyScore('jkf', 'JFK');
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(0.5);
    });

    it('matches a typo inside one word of a multi-word candidate', () => {
      const result = fuzzyScore('konnedy', 'Kennedy Intl');
      expect(result.score).toBeGreaterThanOrEqual(0.3);
      expect(result.score).toBeLessThan(0.5);
      expect(result.ranges).toEqual([{ start: 0, end: 7 }]);
    });
  });

  describe('no match', () => {
    it('scores 0 for unrelated strings', () => {
      expect(fuzzyScore('xyz', 'JFK')).toEqual({ score: 0, ranges: [] });
    });

    it('does not tolerate typos for very short queries', () => {
      expect(fuzzyScore('ab', 'xy')).toEqual({ score: 0, ranges: [] });
    });

    it('scores 0 for a blank query', () => {
      expect(fuzzyScore('', 'JFK')).toEqual({ score: 0, ranges: [] });
      expect(fuzzyScore('   ', 'JFK')).toEqual({ score: 0, ranges: [] });
    });

    it('scores 0 for an empty candidate', () => {
      expect(fuzzyScore('jfk', '')).toEqual({ score: 0, ranges: [] });
    });

    it('returns no match when edits exceed the bound', () => {
      expect(fuzzyScore('abcdefgh', 'zzzzzzzz')).toEqual({ score: 0, ranges: [] });
    });
  });

  describe('tier ordering', () => {
    it('orders exact > prefix > word-prefix > substring > subsequence > typo', () => {
      const exact = fuzzyScore('kennedy', 'kennedy').score;
      const prefix = fuzzyScore('kenn', 'kennedy').score;
      const wordPrefix = fuzzyScore('kennedy', 'john kennedy').score;
      const substring = fuzzyScore('enn', 'kennedy').score;
      const subsequence = fuzzyScore('kndy', 'kennedy').score;
      const typo = fuzzyScore('jfx', 'jfk').score;
      expect(exact).toBeGreaterThan(prefix);
      expect(prefix).toBeGreaterThan(wordPrefix);
      expect(wordPrefix).toBeGreaterThan(substring);
      expect(substring).toBeGreaterThan(subsequence);
      expect(subsequence).toBeGreaterThan(typo);
    });
  });
});
