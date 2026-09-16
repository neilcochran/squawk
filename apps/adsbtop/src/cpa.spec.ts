import { assert, describe, expect, it } from 'vitest';

import type { Aircraft, Coordinates } from '@squawk/types';

import { closestPointOfApproach } from './cpa.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

const LOCATION: Coordinates = { lat: 0, lon: 0 };

describe('closestPointOfApproach', () => {
  it('returns undefined when the aircraft has no position', () => {
    const aircraft = makeAircraft({ trueTrackDeg: 180, groundSpeedKt: 120 });
    expect(closestPointOfApproach(LOCATION, aircraft)).toBeUndefined();
  });

  it('returns undefined when the aircraft has no true track, even with a magnetic heading', () => {
    const aircraft = makeAircraft({
      position: { lat: 1, lon: 0 },
      magneticHeadingDeg: 180,
      groundSpeedKt: 120,
    });
    expect(closestPointOfApproach(LOCATION, aircraft)).toBeUndefined();
  });

  it('returns undefined when the aircraft has no ground speed', () => {
    const aircraft = makeAircraft({ position: { lat: 1, lon: 0 }, trueTrackDeg: 180 });
    expect(closestPointOfApproach(LOCATION, aircraft)).toBeUndefined();
  });

  it('returns undefined when the aircraft is stationary', () => {
    const aircraft = makeAircraft({
      position: { lat: 1, lon: 0 },
      trueTrackDeg: 180,
      groundSpeedKt: 0,
    });
    expect(closestPointOfApproach(LOCATION, aircraft)).toBeUndefined();
  });

  it('returns undefined when the aircraft is already opening', () => {
    const aircraft = makeAircraft({
      position: { lat: 0, lon: 1 },
      trueTrackDeg: 90,
      groundSpeedKt: 120,
    });
    expect(closestPointOfApproach(LOCATION, aircraft)).toBeUndefined();
  });

  it('passes through the receiver when tracking straight at it', () => {
    const aircraft = makeAircraft({
      position: { lat: 1, lon: 0 },
      trueTrackDeg: 180,
      groundSpeedKt: 120,
    });
    const cpa = closestPointOfApproach(LOCATION, aircraft);
    assert(cpa !== undefined);
    expect(cpa.distanceNm).toBeCloseTo(0, 3);
    expect(cpa.timeToClosestApproachSec).toBeGreaterThan(1795);
    expect(cpa.timeToClosestApproachSec).toBeLessThan(1805);
  });

  it('reports the current distance with zero time when passing abeam', () => {
    const aircraft = makeAircraft({
      position: { lat: 0, lon: 1 },
      trueTrackDeg: 0,
      groundSpeedKt: 60,
    });
    const cpa = closestPointOfApproach(LOCATION, aircraft);
    assert(cpa !== undefined);
    expect(cpa.distanceNm).toBeCloseTo(60.04, 1);
    expect(cpa.timeToClosestApproachSec).toBeCloseTo(0, 3);
  });

  it('projects a diagonal track to its nearest point', () => {
    const aircraft = makeAircraft({
      position: { lat: 1, lon: 0 },
      trueTrackDeg: 135,
      groundSpeedKt: 100,
    });
    const cpa = closestPointOfApproach(LOCATION, aircraft);
    assert(cpa !== undefined);
    expect(cpa.distanceNm).toBeCloseTo(42.45, 0);
    expect(cpa.timeToClosestApproachSec).toBeGreaterThan(1520);
    expect(cpa.timeToClosestApproachSec).toBeLessThan(1535);
  });
});
