import { describe, expect, it } from 'vitest';

import { RANGE_KEYS, rangeKeyDirection } from './range-keys.js';

describe('rangeKeyDirection', () => {
  it('zooms in on +, =, and ]', () => {
    expect(rangeKeyDirection('+')).toBe('in');
    expect(rangeKeyDirection('=')).toBe('in');
    expect(rangeKeyDirection(']')).toBe('in');
  });

  it('zooms out on -, _, and [', () => {
    expect(rangeKeyDirection('-')).toBe('out');
    expect(rangeKeyDirection('_')).toBe('out');
    expect(rangeKeyDirection('[')).toBe('out');
  });

  it('maps every configured range key', () => {
    for (const key of RANGE_KEYS.in) {
      expect(rangeKeyDirection(key)).toBe('in');
    }
    for (const key of RANGE_KEYS.out) {
      expect(rangeKeyDirection(key)).toBe('out');
    }
  });

  it('ignores every other key', () => {
    expect(rangeKeyDirection('a')).toBeUndefined();
    expect(rangeKeyDirection('Enter')).toBeUndefined();
  });
});
