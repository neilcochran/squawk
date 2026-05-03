import { describe, it, expect, assert } from 'vitest';

import { close } from './test-utils.js';

import { navigation } from './index.js';

describe('holdingPatternEntry', () => {
  describe('right-turn hold', () => {
    it('returns direct when approaching on the inbound course', () => {
      // Inbound 090, heading to fix 090: flying the inbound course.
      expect(navigation.holdingPatternEntry(90, 90)).toBe('direct');
    });

    it('returns direct when approaching from the holding side', () => {
      // Inbound 090, heading to fix 180: approaching from the south.
      expect(navigation.holdingPatternEntry(90, 180)).toBe('direct');
    });

    it('returns parallel when approaching aligned with the outbound', () => {
      // Inbound 090, heading to fix 270: opposite direction.
      expect(navigation.holdingPatternEntry(90, 270)).toBe('parallel');
    });

    it('returns teardrop for the teardrop sector', () => {
      // Inbound 090, heading to fix 360: approaching from the north.
      expect(navigation.holdingPatternEntry(90, 360)).toBe('teardrop');
    });

    it('returns parallel at the parallel/teardrop boundary', () => {
      // Inbound 090, outbound 270. diff = normalize(300 - 270) = 30 < 70: parallel.
      expect(navigation.holdingPatternEntry(90, 300)).toBe('parallel');
    });

    it('returns teardrop at exactly 70 degrees from outbound', () => {
      // Inbound 090, outbound 270. heading = 270 + 70 = 340.
      // theta = normalize(340 - 270) = 70, which is >= 70 -> teardrop.
      expect(navigation.holdingPatternEntry(90, 340)).toBe('teardrop');
    });

    it('returns direct at exactly 180 degrees from outbound', () => {
      // Inbound 090, outbound 270. heading = 270 + 180 = 450 = 090.
      // theta = normalize(90 - 270) = 180, which is >= 180 -> direct.
      expect(navigation.holdingPatternEntry(90, 90)).toBe('direct');
    });
  });

  describe('left-turn hold', () => {
    it('returns direct when approaching on the inbound course', () => {
      expect(navigation.holdingPatternEntry(90, 90, false)).toBe('direct');
    });

    it('returns parallel when approaching aligned with the outbound', () => {
      expect(navigation.holdingPatternEntry(90, 270, false)).toBe('parallel');
    });

    it('returns teardrop for the mirrored teardrop sector', () => {
      // Left-turn hold inbound 090: teardrop sector is to the south (opposite of right-turn).
      // Heading 180: theta = normalize(270 - 180) = 90, in [70, 180) = teardrop.
      expect(navigation.holdingPatternEntry(90, 180, false)).toBe('teardrop');
    });
  });
});

describe('dmeArcLeadRadial', () => {
  it('returns a positive lead angle', () => {
    const lead = navigation.dmeArcLeadRadial(10, 120);
    assert(lead > 0, `expected positive lead angle, got ${lead}`);
  });

  it('increases with higher TAS', () => {
    const slow = navigation.dmeArcLeadRadial(10, 100);
    const fast = navigation.dmeArcLeadRadial(10, 180);
    assert(fast > slow, `expected fast (${fast}) > slow (${slow})`);
  });

  it('decreases with larger arc radius', () => {
    const small = navigation.dmeArcLeadRadial(5, 120);
    const large = navigation.dmeArcLeadRadial(15, 120);
    assert(small > large, `expected small arc (${small}) > large arc (${large})`);
  });

  it('returns a reasonable value for typical parameters', () => {
    // 10 NM arc, 120 kt, 25-degree bank: expect roughly 2-5 degrees.
    const lead = navigation.dmeArcLeadRadial(10, 120, 25);
    assert(lead > 1 && lead < 10, `expected 1-10 degrees, got ${lead}`);
  });

  it('uses default 25-degree bank when bank angle is omitted', () => {
    const withDefault = navigation.dmeArcLeadRadial(10, 120);
    const withExplicit = navigation.dmeArcLeadRadial(10, 120, 25);
    assert(close(withDefault, withExplicit, 0.001), `expected ${withExplicit}, got ${withDefault}`);
  });
});

describe('correctionAngle', () => {
  it('computes 1-in-60 correction angle', () => {
    // 1 NM off course after 60 NM: 1 degree correction.
    const corr = navigation.correctionAngle(1, 60);
    assert(close(corr, 1, 0.001), `expected 1 degree, got ${corr}`);
  });

  it('scales linearly', () => {
    // 2 NM off course after 30 NM: 4 degrees.
    const corr = navigation.correctionAngle(2, 30);
    assert(close(corr, 4, 0.001), `expected 4 degrees, got ${corr}`);
  });

  it('produces large angles for significant crosstrack error at short distance', () => {
    // 5 NM off course after 20 NM: 15 degrees.
    // The 1-in-60 rule degrades for larger angles but remains useful as an approximation.
    const corr = navigation.correctionAngle(5, 20);
    assert(close(corr, 15, 0.001), `expected 15 degrees, got ${corr}`);
  });
});

describe('offCourseDistance', () => {
  it('computes off-course distance from the 1-in-60 rule', () => {
    // 1 degree error over 60 NM: 1 NM off course.
    const dist = navigation.offCourseDistance(1, 60);
    assert(close(dist, 1, 0.001), `expected 1 NM, got ${dist}`);
  });

  it('round-trips with correctionAngle', () => {
    const originalDist = 2.5;
    const flown = 45;
    const corr = navigation.correctionAngle(originalDist, flown);
    const roundTripped = navigation.offCourseDistance(corr, flown);
    assert(
      close(roundTripped, originalDist, 0.001),
      `expected ~${originalDist}, got ${roundTripped}`,
    );
  });
});
