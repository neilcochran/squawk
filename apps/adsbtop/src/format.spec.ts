import { describe, expect, it } from 'vitest';

import type { Aircraft } from '@squawk/types';

import type { MessageLogEntry } from './aircraft-state.js';
import {
  formatAge,
  formatAltitude,
  formatBearing,
  formatClosestApproach,
  formatDistance,
  formatDuration,
  formatGroundSpeed,
  formatHeading,
  formatMessageLogLine,
  formatOnGround,
  formatVerticalRate,
} from './format.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

describe('formatAltitude', () => {
  it('prefers barometric altitude over geometric', () => {
    const aircraft = makeAircraft({
      position: { lat: 0, lon: 0, baroAltitudeFt: 5500.4, geoAltitudeFt: 5600 },
    });
    expect(formatAltitude(aircraft, 'aviation')).toBe('5500ft');
  });

  it('falls back to geometric altitude when barometric is unavailable', () => {
    const aircraft = makeAircraft({ position: { lat: 0, lon: 0, geoAltitudeFt: 5600 } });
    expect(formatAltitude(aircraft, 'aviation')).toBe('5600ft');
  });

  it('returns a placeholder when neither altitude field is populated', () => {
    expect(formatAltitude(makeAircraft(), 'aviation')).toBe('-');
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
    expect(formatGroundSpeed(makeAircraft({ groundSpeedKt: 249.6 }), 'aviation')).toBe('250kt');
  });

  it('returns a placeholder when unavailable', () => {
    expect(formatGroundSpeed(makeAircraft(), 'aviation')).toBe('-');
  });
});

describe('formatDistance', () => {
  it('rounds and suffixes distance', () => {
    expect(formatDistance(41.6, 'aviation')).toBe('42nm');
  });

  it('returns a placeholder when undefined', () => {
    expect(formatDistance(undefined, 'aviation')).toBe('-');
  });
});

describe('formatBearing', () => {
  it('rounds and suffixes bearing with a degree sign', () => {
    expect(formatBearing(269.6)).toBe('270°');
  });

  it('returns a placeholder when undefined', () => {
    expect(formatBearing(undefined)).toBe('-');
  });
});

describe('formatVerticalRate', () => {
  it('prefixes a climb with a plus sign', () => {
    expect(formatVerticalRate(makeAircraft({ verticalRateFtPerMin: 1200 }), 'aviation')).toBe(
      '+1200fpm',
    );
  });

  it('leaves a descent with its natural minus sign', () => {
    expect(formatVerticalRate(makeAircraft({ verticalRateFtPerMin: -800 }), 'aviation')).toBe(
      '-800fpm',
    );
  });

  it('does not prefix a level rate of zero', () => {
    expect(formatVerticalRate(makeAircraft({ verticalRateFtPerMin: 0 }), 'aviation')).toBe('0fpm');
  });

  it('returns a placeholder when unavailable', () => {
    expect(formatVerticalRate(makeAircraft(), 'aviation')).toBe('-');
  });
});

describe('formatDuration', () => {
  it('formats sub-minute durations in seconds', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats sub-hour durations as padded minutes and seconds', () => {
    expect(formatDuration(65)).toBe('1m05s');
  });

  it('formats hour-plus durations as padded hours and minutes', () => {
    expect(formatDuration(2 * 60 * 60 + 3 * 60)).toBe('2h03m');
  });
});

describe('formatClosestApproach', () => {
  it('keeps one decimal on the distance under 10 nm', () => {
    expect(
      formatClosestApproach({ distanceNm: 2.14, timeToClosestApproachSec: 250.4 }, 'aviation'),
    ).toBe('2.1nm in 4m10s');
  });

  it('rounds the distance to whole miles from 10 nm up', () => {
    expect(
      formatClosestApproach({ distanceNm: 41.6, timeToClosestApproachSec: 3900 }, 'aviation'),
    ).toBe('42nm in 1h05m');
  });

  it('rounds a distance that lands on 10.0 up to whole miles', () => {
    expect(
      formatClosestApproach({ distanceNm: 9.97, timeToClosestApproachSec: 0 }, 'aviation'),
    ).toBe('10nm in 0s');
  });

  it('returns a placeholder when undefined', () => {
    expect(formatClosestApproach(undefined, 'aviation')).toBe('-');
  });
});

describe('metric rendering', () => {
  it('renders altitude, speed, distance, vertical rate, and closest approach in metric', () => {
    const aircraft = makeAircraft({
      position: { lat: 0, lon: 0, baroAltitudeFt: 35_000 },
      groundSpeedKt: 515,
      verticalRateFtPerMin: 1200,
    });
    expect(formatAltitude(aircraft, 'metric')).toBe('10668m');
    expect(formatGroundSpeed(aircraft, 'metric')).toBe('954km/h');
    expect(formatVerticalRate(aircraft, 'metric')).toBe('+6.1m/s');
    expect(formatDistance(100, 'metric')).toBe('185km');
    expect(
      formatClosestApproach({ distanceNm: 2.14, timeToClosestApproachSec: 250 }, 'metric'),
    ).toBe('4.0km in 4m10s');
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

describe('formatMessageLogLine', () => {
  function makeEntry(overrides: Partial<MessageLogEntry> = {}): MessageLogEntry {
    return { id: 0, type: 'new', icaoHex: 'A0B1C2', callsign: undefined, at: 0, ...overrides };
  }

  it('renders a UTC HH:MM:SS clock, the type label, hex, and callsign', () => {
    const entry = makeEntry({
      type: 'new',
      icaoHex: 'A0B1C2',
      callsign: 'UAL123',
      at: Date.UTC(2026, 0, 1, 14, 23, 5),
    });
    expect(formatMessageLogLine(entry)).toBe('14:23:05  NEW   A0B1C2  UAL123');
  });

  it('labels update and lost events distinctly', () => {
    expect(formatMessageLogLine(makeEntry({ type: 'update' }))).toContain('UPDT');
    expect(formatMessageLogLine(makeEntry({ type: 'lost' }))).toContain('LOST');
  });

  it('shows a placeholder when the callsign is unknown', () => {
    expect(formatMessageLogLine(makeEntry({ callsign: undefined }))).toContain('  -');
  });
});
