import { describe, expect, it } from 'vitest';

import type { Aircraft, Coordinates } from '@squawk/types';

import { bearingToAircraftDeg, distanceToAircraftNm } from './location.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

const LOCATION: Coordinates = { lat: 0, lon: 0 };

describe('distanceToAircraftNm', () => {
  it('returns undefined when the aircraft has no position', () => {
    expect(distanceToAircraftNm(LOCATION, makeAircraft())).toBeUndefined();
  });

  it('returns the great-circle distance in nautical miles', () => {
    const aircraft = makeAircraft({ position: { lat: 1, lon: 0 } });
    expect(distanceToAircraftNm(LOCATION, aircraft)).toBeCloseTo(60.04, 1);
  });
});

describe('bearingToAircraftDeg', () => {
  it('returns undefined when the aircraft has no position', () => {
    expect(bearingToAircraftDeg(LOCATION, makeAircraft())).toBeUndefined();
  });

  it('returns 0 for an aircraft due north', () => {
    const aircraft = makeAircraft({ position: { lat: 1, lon: 0 } });
    expect(bearingToAircraftDeg(LOCATION, aircraft)).toBeCloseTo(0, 5);
  });

  it('returns 90 for an aircraft due east', () => {
    const aircraft = makeAircraft({ position: { lat: 0, lon: 1 } });
    expect(bearingToAircraftDeg(LOCATION, aircraft)).toBeCloseTo(90, 5);
  });
});
