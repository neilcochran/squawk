import { describe, expect, it } from 'vitest';

import { formatHeading, formatPolarPosition, formatTrueBearing } from './position-format.js';

describe('formatHeading', () => {
  it('rounds to three digits', () => {
    expect(formatHeading(47.4)).toBe('047');
    expect(formatHeading(47.5)).toBe('048');
    expect(formatHeading(180)).toBe('180');
  });

  it('writes north as 360, from either side of it', () => {
    expect(formatHeading(0)).toBe('360');
    expect(formatHeading(359.6)).toBe('360');
    expect(formatHeading(360)).toBe('360');
  });
});

describe('formatTrueBearing', () => {
  it('says that the bearing is true', () => {
    expect(formatTrueBearing(269.7)).toBe('270 true');
  });
});

describe('formatPolarPosition', () => {
  it('writes the bearing, then the range to a tenth of a mile', () => {
    expect(formatPolarPosition({ trueBearingDeg: 47.4, rangeNm: 12.34 })).toBe('047 true, 12.3 nm');
    expect(formatPolarPosition({ trueBearingDeg: 0, rangeNm: 0 })).toBe('360 true, 0.0 nm');
  });
});
