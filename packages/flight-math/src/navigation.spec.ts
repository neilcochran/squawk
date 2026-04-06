import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import { distance } from '@squawk/units';
import { navigation } from './index.js';

describe('holdingPatternEntry', () => {
  describe('right-turn hold', () => {
    it('returns direct when approaching on the inbound course', () => {
      // Inbound 090, heading to fix 090: flying the inbound course.
      assert.equal(navigation.holdingPatternEntry(90, 90), 'direct');
    });

    it('returns direct when approaching from the holding side', () => {
      // Inbound 090, heading to fix 180: approaching from the south.
      assert.equal(navigation.holdingPatternEntry(90, 180), 'direct');
    });

    it('returns parallel when approaching aligned with the outbound', () => {
      // Inbound 090, heading to fix 270: opposite direction.
      assert.equal(navigation.holdingPatternEntry(90, 270), 'parallel');
    });

    it('returns teardrop for the teardrop sector', () => {
      // Inbound 090, heading to fix 360: approaching from the north.
      assert.equal(navigation.holdingPatternEntry(90, 360), 'teardrop');
    });

    it('returns parallel at the parallel/teardrop boundary', () => {
      // Inbound 090, outbound 270. diff = normalize(300 - 270) = 30 < 70: parallel.
      assert.equal(navigation.holdingPatternEntry(90, 300), 'parallel');
    });
  });

  describe('left-turn hold', () => {
    it('returns direct when approaching on the inbound course', () => {
      assert.equal(navigation.holdingPatternEntry(90, 90, false), 'direct');
    });

    it('returns parallel when approaching aligned with the outbound', () => {
      assert.equal(navigation.holdingPatternEntry(90, 270, false), 'parallel');
    });

    it('returns teardrop for the mirrored teardrop sector', () => {
      // Left-turn hold inbound 090: teardrop sector is to the south (opposite of right-turn).
      // Heading 180: theta = normalize(270 - 180) = 90, in [70, 180) = teardrop.
      assert.equal(navigation.holdingPatternEntry(90, 180, false), 'teardrop');
    });
  });
});

describe('dmeArcLeadRadial', () => {
  it('returns a positive lead angle', () => {
    const lead = navigation.dmeArcLeadRadial(10, 120);
    assert.ok(lead > 0, `expected positive lead angle, got ${lead}`);
  });

  it('increases with higher TAS', () => {
    const slow = navigation.dmeArcLeadRadial(10, 100);
    const fast = navigation.dmeArcLeadRadial(10, 180);
    assert.ok(fast > slow, `expected fast (${fast}) > slow (${slow})`);
  });

  it('decreases with larger arc radius', () => {
    const small = navigation.dmeArcLeadRadial(5, 120);
    const large = navigation.dmeArcLeadRadial(15, 120);
    assert.ok(small > large, `expected small arc (${small}) > large arc (${large})`);
  });

  it('returns a reasonable value for typical parameters', () => {
    // 10 NM arc, 120 kt, 25-degree bank: expect roughly 2-5 degrees.
    const lead = navigation.dmeArcLeadRadial(10, 120, 25);
    assert.ok(lead > 1 && lead < 10, `expected 1-10 degrees, got ${lead}`);
  });
});

describe('greatCircleBearing', () => {
  it('returns 0/360 for a due-north bearing', () => {
    // From equator to north pole.
    const brg = navigation.greatCircleBearing(0, 0, 90, 0);
    assert.ok(close(brg, 0, 0.1) || close(brg, 360, 0.1), `expected ~0/360, got ${brg}`);
  });

  it('returns 180 for a due-south bearing', () => {
    const brg = navigation.greatCircleBearing(45, 0, 0, 0);
    assert.ok(close(brg, 180, 0.1), `expected ~180, got ${brg}`);
  });

  it('returns 90 for a due-east bearing from the equator', () => {
    const brg = navigation.greatCircleBearing(0, 0, 0, 10);
    assert.ok(close(brg, 90, 0.1), `expected ~90, got ${brg}`);
  });

  it('returns 270 for a due-west bearing from the equator', () => {
    const brg = navigation.greatCircleBearing(0, 0, 0, -10);
    assert.ok(close(brg, 270, 0.1), `expected ~270, got ${brg}`);
  });

  it('computes a realistic bearing for JFK to LAX', () => {
    // JFK (40.6413, -73.7781) to LAX (33.9425, -118.4081).
    // Expected initial bearing roughly 265-275 degrees (west-southwest).
    const brg = navigation.greatCircleBearing(40.6413, -73.7781, 33.9425, -118.4081);
    assert.ok(brg > 260 && brg < 280, `expected 260-280, got ${brg}`);
  });
});

describe('greatCircleBearingAndDistance', () => {
  it('returns both bearing and distance', () => {
    const result = navigation.greatCircleBearingAndDistance(0, 0, 0, 1);
    assert.ok(close(result.bearingDeg, 90, 0.1), `expected bearing ~90, got ${result.bearingDeg}`);
    assert.ok(close(result.distanceNm, 60, 0.5), `expected ~60 NM, got ${result.distanceNm}`);
  });

  it('matches individual bearing and distance functions', () => {
    const lat1 = 40.6413;
    const lon1 = -73.7781;
    const lat2 = 33.9425;
    const lon2 = -118.4081;
    const result = navigation.greatCircleBearingAndDistance(lat1, lon1, lat2, lon2);
    const expectedBrg = navigation.greatCircleBearing(lat1, lon1, lat2, lon2);
    const expectedDist = distance.greatCircleDistanceNm(lat1, lon1, lat2, lon2);
    assert.ok(close(result.bearingDeg, expectedBrg, 0.001));
    assert.ok(close(result.distanceNm, expectedDist, 0.001));
  });
});

describe('correctionAngle', () => {
  it('computes 1-in-60 correction angle', () => {
    // 1 NM off course after 60 NM: 1 degree correction.
    const corr = navigation.correctionAngle(1, 60);
    assert.ok(close(corr, 1, 0.001), `expected 1 degree, got ${corr}`);
  });

  it('scales linearly', () => {
    // 2 NM off course after 30 NM: 4 degrees.
    const corr = navigation.correctionAngle(2, 30);
    assert.ok(close(corr, 4, 0.001), `expected 4 degrees, got ${corr}`);
  });
});

describe('offCourseDistance', () => {
  it('computes off-course distance from the 1-in-60 rule', () => {
    // 1 degree error over 60 NM: 1 NM off course.
    const dist = navigation.offCourseDistance(1, 60);
    assert.ok(close(dist, 1, 0.001), `expected 1 NM, got ${dist}`);
  });

  it('round-trips with correctionAngle', () => {
    const originalDist = 2.5;
    const flown = 45;
    const corr = navigation.correctionAngle(originalDist, flown);
    const roundTripped = navigation.offCourseDistance(corr, flown);
    assert.ok(
      close(roundTripped, originalDist, 0.001),
      `expected ~${originalDist}, got ${roundTripped}`,
    );
  });
});
