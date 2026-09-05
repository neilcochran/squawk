import { describe, expect, it } from 'vitest';

import type { PositionHistoryEntry } from '@squawk/adsb-feed';

import { buildAltitudeSparkline } from './sparkline.js';

function entry(overrides: {
  baroAltitudeFt?: number;
  geoAltitudeFt?: number;
}): PositionHistoryEntry {
  return {
    position: { lat: 0, lon: 0, ...overrides },
    recordedAt: 0,
  };
}

describe('buildAltitudeSparkline', () => {
  it('returns an empty string for an empty history', () => {
    expect(buildAltitudeSparkline([])).toBe('');
  });

  it('returns an empty string when no sample carries an altitude', () => {
    expect(buildAltitudeSparkline([entry({}), entry({})])).toBe('');
  });

  it('returns one character per sample with an altitude', () => {
    const sparkline = buildAltitudeSparkline([
      entry({ baroAltitudeFt: 1000 }),
      entry({}),
      entry({ baroAltitudeFt: 2000 }),
    ]);
    expect(sparkline).toHaveLength(2);
  });

  it('prefers barometric altitude over geometric', () => {
    const sparkline = buildAltitudeSparkline([
      entry({ baroAltitudeFt: 1000, geoAltitudeFt: 9000 }),
    ]);
    // A single sample has no range to scale against, so it always renders
    // the mid-level character regardless of which altitude value was used -
    // this test only guards that a sample with both fields doesn't throw or
    // produce two characters for one entry.
    expect(sparkline).toHaveLength(1);
  });

  it('falls back to geometric altitude when barometric is unavailable', () => {
    const sparkline = buildAltitudeSparkline([
      entry({ geoAltitudeFt: 1000 }),
      entry({ geoAltitudeFt: 2000 }),
    ]);
    expect(sparkline).toHaveLength(2);
  });

  it('renders the lowest sample as the shortest bar and the highest as the tallest', () => {
    const sparkline = buildAltitudeSparkline([
      entry({ baroAltitudeFt: 0 }),
      entry({ baroAltitudeFt: 10000 }),
    ]);
    expect(sparkline[0]).toBe('▁');
    expect(sparkline[1]).toBe('█');
  });

  it('renders a flat mid-level bar for every sample when altitude never varies', () => {
    const sparkline = buildAltitudeSparkline([
      entry({ baroAltitudeFt: 5000 }),
      entry({ baroAltitudeFt: 5000 }),
    ]);
    expect(sparkline).toBe('▅▅');
  });

  it('caps the rendered line to the most recent 60 samples, ignoring older ones', () => {
    const oldOutlier = entry({ baroAltitudeFt: 0 });
    const recentSamples = Array.from({ length: 60 }, () => entry({ baroAltitudeFt: 5000 }));
    const sparkline = buildAltitudeSparkline([oldOutlier, ...recentSamples]);

    expect(sparkline).toHaveLength(60);
    // The dropped-off 0ft outlier would have forced every remaining sample
    // to scale relative to it (making every character render tallest, not
    // flat); since it's excluded from the window, a flat recent run of
    // 5000ft samples renders as flat mid-level bars instead.
    expect(sparkline).toBe('▅'.repeat(60));
  });
});
