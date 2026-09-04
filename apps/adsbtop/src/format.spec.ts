import { describe, expect, it } from 'vitest';

import type { Aircraft } from '@squawk/types';

import {
  formatAge,
  formatAltitude,
  formatGroundSpeed,
  formatHeading,
  formatOnGround,
  formatVerticalRate,
  isEmergencySquawk,
} from './format.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

describe('isEmergencySquawk', () => {
  it.each(['7500', '7600', '7700'])('treats %s as an emergency squawk', (squawk) => {
    expect(isEmergencySquawk(squawk)).toBe(true);
  });

  it('does not treat a routine squawk as an emergency', () => {
    expect(isEmergencySquawk('1200')).toBe(false);
  });

  it('returns false when squawk is undefined', () => {
    expect(isEmergencySquawk(undefined)).toBe(false);
  });
});

describe('formatAltitude', () => {
  it('prefers barometric altitude over geometric', () => {
    const aircraft = makeAircraft({
      position: { lat: 0, lon: 0, baroAltitudeFt: 5500.4, geoAltitudeFt: 5600 },
    });
    expect(formatAltitude(aircraft)).toBe('5500ft');
  });

  it('falls back to geometric altitude when barometric is unavailable', () => {
    const aircraft = makeAircraft({ position: { lat: 0, lon: 0, geoAltitudeFt: 5600 } });
    expect(formatAltitude(aircraft)).toBe('5600ft');
  });

  it('returns a placeholder when neither altitude field is populated', () => {
    expect(formatAltitude(makeAircraft())).toBe('-');
  });
});

describe('formatOnGround', () => {
  it('shows GND when onGround is true', () => {
    expect(formatOnGround(makeAircraft({ onGround: true }))).toBe('GND');
  });

  it('shows a placeholder when airborne', () => {
    expect(formatOnGround(makeAircraft({ onGround: false }))).toBe('-');
  });

  it('shows a placeholder when unknown', () => {
    expect(formatOnGround(makeAircraft())).toBe('-');
  });
});

describe('formatHeading', () => {
  it('prefers true track over magnetic heading', () => {
    expect(formatHeading(makeAircraft({ trueTrackDeg: 90.6, magneticHeadingDeg: 100 }))).toBe(
      '91°',
    );
  });

  it('falls back to magnetic heading when true track is unavailable', () => {
    expect(formatHeading(makeAircraft({ magneticHeadingDeg: 270 }))).toBe('270°');
  });

  it('returns a placeholder when neither heading field is populated', () => {
    expect(formatHeading(makeAircraft())).toBe('-');
  });
});

describe('formatGroundSpeed', () => {
  it('rounds and suffixes ground speed', () => {
    expect(formatGroundSpeed(makeAircraft({ groundSpeedKt: 249.6 }))).toBe('250kt');
  });

  it('returns a placeholder when unavailable', () => {
    expect(formatGroundSpeed(makeAircraft())).toBe('-');
  });
});

describe('formatVerticalRate', () => {
  it('prefixes a climb with a plus sign', () => {
    expect(formatVerticalRate(makeAircraft({ verticalRateFtPerMin: 1200 }))).toBe('+1200fpm');
  });

  it('leaves a descent with its natural minus sign', () => {
    expect(formatVerticalRate(makeAircraft({ verticalRateFtPerMin: -800 }))).toBe('-800fpm');
  });

  it('does not prefix a level rate of zero', () => {
    expect(formatVerticalRate(makeAircraft({ verticalRateFtPerMin: 0 }))).toBe('0fpm');
  });

  it('returns a placeholder when unavailable', () => {
    expect(formatVerticalRate(makeAircraft())).toBe('-');
  });
});

describe('formatAge', () => {
  it('formats sub-minute ages in seconds', () => {
    expect(formatAge(0, 45_000)).toBe('45s');
  });

  it('formats sub-hour ages as padded minutes and seconds', () => {
    expect(formatAge(0, 65_000)).toBe('1m05s');
  });

  it('formats hour-plus ages as padded hours and minutes', () => {
    expect(formatAge(0, 2 * 60 * 60 * 1000 + 3 * 60 * 1000)).toBe('2h03m');
  });

  it('clamps a negative elapsed time to zero', () => {
    expect(formatAge(10_000, 0)).toBe('0s');
  });
});
