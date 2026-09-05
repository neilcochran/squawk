import { describe, expect, it } from 'vitest';

import type { Aircraft } from '@squawk/types';

import type { MessageLogEntry } from './aircraft-state.js';
import {
  formatAge,
  formatAltitude,
  formatBearing,
  formatDistance,
  formatGroundSpeed,
  formatHeading,
  formatMessageLogLine,
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

describe('formatDistance', () => {
  it('rounds and suffixes distance', () => {
    expect(formatDistance(41.6)).toBe('42nm');
  });

  it('returns a placeholder when undefined', () => {
    expect(formatDistance(undefined)).toBe('-');
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
