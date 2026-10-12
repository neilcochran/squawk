import { describe, it, expect } from 'vitest';

import type { AltitudeBound } from '@squawk/types';

import { altitudeMatches } from './vertical-filter.js';

const sfc: AltitudeBound = { valueFt: 0, reference: 'SFC' };
const msl = (ft: number): AltitudeBound => ({ valueFt: ft, reference: 'MSL' });
const agl = (ft: number): AltitudeBound => ({ valueFt: ft, reference: 'AGL' });

describe('altitudeMatches', () => {
  describe('MSL floor and ceiling', () => {
    it('returns true when altitude is within bounds', () => {
      expect(altitudeMatches(5000, msl(3000), msl(10000))).toBe(true);
    });

    it('returns true when altitude equals the floor', () => {
      expect(altitudeMatches(3000, msl(3000), msl(10000))).toBe(true);
    });

    it('returns true when altitude equals the ceiling', () => {
      expect(altitudeMatches(10000, msl(3000), msl(10000))).toBe(true);
    });

    it('returns false when altitude is below the floor', () => {
      expect(altitudeMatches(2000, msl(3000), msl(10000))).toBe(false);
    });

    it('returns false when altitude is above the ceiling', () => {
      expect(altitudeMatches(11000, msl(3000), msl(10000))).toBe(false);
    });
  });

  describe('SFC floor', () => {
    it('returns true for altitude at ground level', () => {
      expect(altitudeMatches(0, sfc, msl(10000))).toBe(true);
    });

    it('returns true for altitude within SFC-to-ceiling range', () => {
      expect(altitudeMatches(5000, sfc, msl(10000))).toBe(true);
    });

    it('returns false for altitude above ceiling', () => {
      expect(altitudeMatches(15000, sfc, msl(10000))).toBe(false);
    });
  });

  describe('AGL bounds (conservative inclusion)', () => {
    it('includes when floor is AGL and altitude is above AGL value', () => {
      // Cannot resolve AGL, so floor check is skipped
      expect(altitudeMatches(5000, agl(1000), msl(10000))).toBe(true);
    });

    it('includes when floor is AGL and altitude is below AGL value', () => {
      // Even though 500 < 1000 AGL, we cannot know the MSL equivalent,
      // so the floor check is skipped and the feature is included
      expect(altitudeMatches(500, agl(1000), msl(10000))).toBe(true);
    });

    it('includes when ceiling is AGL', () => {
      expect(altitudeMatches(5000, sfc, agl(3000))).toBe(true);
    });

    it('includes when both floor and ceiling are AGL', () => {
      expect(altitudeMatches(5000, agl(1000), agl(3000))).toBe(true);
    });

    it('still excludes on MSL side when AGL on other side', () => {
      // Floor is MSL 8000, altitude is 5000 - excluded by the MSL floor
      expect(altitudeMatches(5000, msl(8000), agl(15000))).toBe(false);
    });
  });

  describe('unlimited ceiling sentinel', () => {
    it('includes altitude below 99999 MSL sentinel', () => {
      expect(altitudeMatches(45000, sfc, msl(99999))).toBe(true);
    });
  });

  describe('exclusive bounds', () => {
    const exclusiveFl180 = { valueFt: 18000, reference: 'MSL', inclusive: false } as const;
    const exclusiveFloor = { valueFt: 5500, reference: 'MSL', inclusive: false } as const;

    it('excludes an altitude equal to an exclusive ceiling', () => {
      // A MOA designated "to but not including FL 180" ends at 17,999 ft.
      expect(altitudeMatches(17999, msl(10000), exclusiveFl180)).toBe(true);
      expect(altitudeMatches(18000, msl(10000), exclusiveFl180)).toBe(false);
    });

    it('excludes an altitude equal to an exclusive floor', () => {
      expect(altitudeMatches(5500, exclusiveFloor, msl(10000))).toBe(false);
      expect(altitudeMatches(5501, exclusiveFloor, msl(10000))).toBe(true);
    });

    it('treats a bound without the flag, or with inclusive true, as inclusive', () => {
      expect(altitudeMatches(18000, msl(10000), msl(18000))).toBe(true);
      expect(
        altitudeMatches(18000, msl(10000), { valueFt: 18000, reference: 'MSL', inclusive: true }),
      ).toBe(true);
    });

    it('still skips an exclusive AGL bound it cannot resolve', () => {
      expect(
        altitudeMatches(500, { valueFt: 500, reference: 'AGL', inclusive: false }, msl(10000)),
      ).toBe(true);
    });
  });

  describe('negative altitude', () => {
    it('excludes negative altitude when floor is SFC (resolved to 0)', () => {
      // SFC resolves to 0 ft MSL, so -100 is below the floor
      expect(altitudeMatches(-100, sfc, msl(10000))).toBe(false);
    });

    it('excludes negative altitude when floor is MSL 0', () => {
      expect(altitudeMatches(-100, msl(0), msl(10000))).toBe(false);
    });

    it('includes negative altitude when floor is AGL (conservative)', () => {
      // AGL floor cannot be resolved, so the check is skipped
      expect(altitudeMatches(-100, agl(500), msl(10000))).toBe(true);
    });
  });
});
