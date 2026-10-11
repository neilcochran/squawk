import { describe, it, expect } from 'vitest';

import { formatDistanceNm, formatEteHrs } from './plan-format.ts';

describe('formatDistanceNm', () => {
  it('rounds to the nearest whole mile with a unit suffix', () => {
    expect(formatDistanceNm(123.4)).toBe('123 nm');
    expect(formatDistanceNm(123.6)).toBe('124 nm');
  });

  it('groups thousands', () => {
    expect(formatDistanceNm(1234.6)).toBe('1,235 nm');
  });

  it('formats zero', () => {
    expect(formatDistanceNm(0)).toBe('0 nm');
  });
});

describe('formatEteHrs', () => {
  it('formats hours and minutes as H:MM', () => {
    expect(formatEteHrs(1.5)).toBe('1:30');
  });

  it('zero-pads single-digit minutes', () => {
    expect(formatEteHrs(2.05)).toBe('2:03');
  });

  it('formats a sub-hour time', () => {
    expect(formatEteHrs(0.75)).toBe('0:45');
  });

  it('rolls a full 60 minutes up into the hour', () => {
    expect(formatEteHrs(0.999)).toBe('1:00');
  });
});
