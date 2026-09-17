import { describe, expect, it } from 'vitest';

import { sparkline } from './sparkline.js';

const LOWEST = '▁';
const HIGHEST = '█';

describe('sparkline', () => {
  it('returns an empty string for no values', () => {
    expect(sparkline([])).toBe('');
  });

  it('draws one glyph per value, scaling the largest to the tallest bar', () => {
    const drawn = sparkline([0, 5, 10]);
    expect([...drawn]).toHaveLength(3);
    expect(drawn.startsWith(LOWEST)).toBe(true);
    expect(drawn.endsWith(HIGHEST)).toBe(true);
  });

  it('draws a run of zeros as a flat line of the lowest glyph', () => {
    expect(sparkline([0, 0, 0])).toBe(LOWEST.repeat(3));
  });

  it('honours a larger explicit ceiling so the chart does not rescale as values grow', () => {
    expect(sparkline([10], 100).endsWith(HIGHEST)).toBe(false);
    expect(sparkline([100], 100).endsWith(HIGHEST)).toBe(true);
  });

  it('ignores an explicit ceiling smaller than the series maximum', () => {
    expect(sparkline([50], 10)).toBe(HIGHEST);
  });
});
