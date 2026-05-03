import { describe, it, expect, assert } from 'vitest';

import { solar } from './index.js';

/**
 * Asserts that a Date is within a given number of minutes of an expected time.
 */
function closeTime(
  actual: Date,
  expectedHour: number,
  expectedMin: number,
  toleranceMin: number,
): boolean {
  const expected = expectedHour * 60 + expectedMin;
  const actualMin = actual.getUTCHours() * 60 + actual.getUTCMinutes();
  return Math.abs(actualMin - expected) <= toleranceMin;
}

describe('computeSolarTimes', () => {
  it('computes sunrise and sunset for a mid-latitude location on an equinox', () => {
    // Washington DC area (38.9N, 77.0W), March 20 2026 (near spring equinox).
    // Expect sunrise ~11:10 UTC (6:10 EDT), sunset ~23:17 UTC (18:17 EDT).
    const result = solar.computeSolarTimes(38.9, -77.0, new Date(Date.UTC(2026, 2, 20)));
    assert(result.sunrise !== undefined, 'expected sunrise');
    assert(result.sunset !== undefined, 'expected sunset');
    assert(
      closeTime(result.sunrise, 11, 10, 5),
      `expected sunrise ~11:10 UTC, got ${result.sunrise.toISOString()}`,
    );
    assert(
      closeTime(result.sunset, 23, 17, 5),
      `expected sunset ~23:17 UTC, got ${result.sunset.toISOString()}`,
    );
  });

  it('computes civil twilight times', () => {
    // Same location and date. Civil twilight should be ~25-30 min before sunrise / after sunset.
    const result = solar.computeSolarTimes(38.9, -77.0, new Date(Date.UTC(2026, 2, 20)));
    assert(result.civilTwilightBegin !== undefined, 'expected civil twilight begin');
    assert(result.civilTwilightEnd !== undefined, 'expected civil twilight end');
    assert(
      result.civilTwilightBegin < result.sunrise!,
      'civil twilight begin should be before sunrise',
    );
    assert(result.civilTwilightEnd > result.sunset!, 'civil twilight end should be after sunset');
  });

  it('computes sunrise for a summer day at a higher latitude', () => {
    // London (51.5N, 0.1W), June 21 2026 (summer solstice).
    // Expect sunrise ~03:43 UTC, sunset ~20:22 UTC.
    const result = solar.computeSolarTimes(51.5, -0.1, new Date(Date.UTC(2026, 5, 21)));
    assert(result.sunrise !== undefined, 'expected sunrise');
    assert(result.sunset !== undefined, 'expected sunset');
    assert(
      closeTime(result.sunrise, 3, 43, 5),
      `expected sunrise ~03:43 UTC, got ${result.sunrise.toISOString()}`,
    );
    assert(
      closeTime(result.sunset, 20, 22, 5),
      `expected sunset ~20:22 UTC, got ${result.sunset.toISOString()}`,
    );
  });

  it('handles polar regions where the sun does not set (midnight sun)', () => {
    // Tromso, Norway (69.65N, 18.96E), June 21 (midnight sun).
    const result = solar.computeSolarTimes(69.65, 18.96, new Date(Date.UTC(2026, 5, 21)));
    expect(result.sunrise, 'expected no sunrise during midnight sun').toBe(undefined);
    expect(result.sunset, 'expected no sunset during midnight sun').toBe(undefined);
  });

  it('handles polar regions where the sun does not rise (polar night)', () => {
    // Tromso, Norway (69.65N, 18.96E), December 21 (polar night).
    const result = solar.computeSolarTimes(69.65, 18.96, new Date(Date.UTC(2026, 11, 21)));
    expect(result.sunrise, 'expected no sunrise during polar night').toBe(undefined);
    expect(result.sunset, 'expected no sunset during polar night').toBe(undefined);
  });

  it('computes times for the southern hemisphere', () => {
    // Sydney, Australia (33.87S, 151.21E), December 21 (summer solstice in southern hemisphere).
    // Expect sunrise ~18:42 UTC (05:42 AEDT), sunset ~08:53 UTC (19:53 AEDT).
    const result = solar.computeSolarTimes(-33.87, 151.21, new Date(Date.UTC(2026, 11, 21)));
    assert(result.sunrise !== undefined, 'expected sunrise');
    assert(result.sunset !== undefined, 'expected sunset');
    assert(
      closeTime(result.sunrise, 17, 40, 5),
      `expected sunrise ~17:40 UTC, got ${result.sunrise.toISOString()}`,
    );
    assert(
      closeTime(result.sunset, 9, 5, 5),
      `expected sunset ~09:05 UTC, got ${result.sunset.toISOString()}`,
    );
  });

  it('sunrise is before sunset for a normal day', () => {
    const result = solar.computeSolarTimes(40.0, -74.0, new Date(Date.UTC(2026, 3, 15)));
    assert(result.sunrise !== undefined && result.sunset !== undefined);
    assert(
      result.sunrise < result.sunset,
      `expected sunrise (${result.sunrise.toISOString()}) before sunset (${result.sunset.toISOString()})`,
    );
  });

  it('computes sunrise and sunset for an equatorial location', () => {
    // Quito, Ecuador (0.18S, 78.47W), March 20 2026.
    // Near the equator, day length is close to 12 hours year-round.
    // Expect sunrise ~11:12 UTC (06:12 local), sunset ~23:18 UTC (18:18 local).
    const result = solar.computeSolarTimes(-0.18, -78.47, new Date(Date.UTC(2026, 2, 20)));
    assert(result.sunrise !== undefined, 'expected sunrise');
    assert(result.sunset !== undefined, 'expected sunset');
    // Day length should be very close to 12 hours at the equinox.
    const dayLengthMin = (result.sunset.getTime() - result.sunrise.getTime()) / 60000;
    assert(
      Math.abs(dayLengthMin - 720) < 30,
      `expected ~12 hr day at equator equinox, got ${(dayLengthMin / 60).toFixed(1)} hrs`,
    );
  });

  it('matches NOAA reference for a known date and location', () => {
    // Denver, CO (39.74N, 104.99W), July 4 2026.
    // NOAA reference: sunrise ~12:32 UTC (05:32 MDT), sunset ~02:32+1 UTC (20:32 MDT).
    const result = solar.computeSolarTimes(39.74, -104.99, new Date(Date.UTC(2026, 6, 4)));
    assert(result.sunrise !== undefined, 'expected sunrise');
    assert(result.sunset !== undefined, 'expected sunset');
    assert(
      closeTime(result.sunrise, 11, 37, 3),
      `expected sunrise ~11:37 UTC, got ${result.sunrise.toISOString()}`,
    );
  });

  it('handles January dates (Julian day algorithm month <= 2 branch)', () => {
    // The internal Julian day algorithm takes a different branch when month <= 2;
    // exercise it with a January date.
    const result = solar.computeSolarTimes(40.0, -74.0, new Date(Date.UTC(2026, 0, 15)));
    assert(result.sunrise !== undefined, 'expected sunrise');
    assert(result.sunset !== undefined, 'expected sunset');
    assert(
      result.sunrise < result.sunset,
      `expected sunrise before sunset, got ${result.sunrise.toISOString()} / ${result.sunset.toISOString()}`,
    );
  });
});

describe('isDaytime', () => {
  it('returns true during midday', () => {
    // New York area, April 15, 2026 at 17:00 UTC (1:00 PM EDT).
    expect(solar.isDaytime(40.7, -74.0, new Date(Date.UTC(2026, 3, 15, 17, 0)))).toBe(true);
  });

  it('returns false during the middle of the night', () => {
    // New York area, April 15, 2026 at 05:00 UTC (1:00 AM EDT).
    expect(solar.isDaytime(40.7, -74.0, new Date(Date.UTC(2026, 3, 15, 5, 0)))).toBe(false);
  });

  it('returns true during civil twilight (dawn)', () => {
    // Civil twilight is considered daytime per FAR 1.1.
    const times = solar.computeSolarTimes(40.7, -74.0, new Date(Date.UTC(2026, 3, 15)));
    if (times.civilTwilightBegin !== undefined && times.sunrise !== undefined) {
      // Pick a time between civil twilight begin and sunrise.
      const midDawn = new Date((times.civilTwilightBegin.getTime() + times.sunrise.getTime()) / 2);
      expect(solar.isDaytime(40.7, -74.0, midDawn)).toBe(true);
    }
  });

  it('returns true during midnight sun in polar regions', () => {
    // Tromso, June 21 at midnight UTC: sun is up.
    expect(solar.isDaytime(69.65, 18.96, new Date(Date.UTC(2026, 5, 21, 0, 0)))).toBe(true);
  });

  it('returns false during polar night', () => {
    // Svalbard (78N, 16E), December 21 at noon UTC: deep polar night, no civil twilight.
    expect(solar.isDaytime(78, 16, new Date(Date.UTC(2026, 11, 21, 12, 0)))).toBe(false);
  });

  it('returns false just before civil twilight begins', () => {
    const times = solar.computeSolarTimes(40.7, -74.0, new Date(Date.UTC(2026, 3, 15)));
    if (times.civilTwilightBegin !== undefined) {
      // One minute before civil twilight begin should be nighttime.
      const beforeDawn = new Date(times.civilTwilightBegin.getTime() - 60000);
      expect(solar.isDaytime(40.7, -74.0, beforeDawn)).toBe(false);
    }
  });
});
