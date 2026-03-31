import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AltitudeBound } from '@squawk/types';
import { altitudeMatches } from './vertical-filter.js';

const sfc: AltitudeBound = { valueFt: 0, reference: 'SFC' };
const msl = (ft: number): AltitudeBound => ({ valueFt: ft, reference: 'MSL' });
const agl = (ft: number): AltitudeBound => ({ valueFt: ft, reference: 'AGL' });

describe('altitudeMatches', () => {
  describe('MSL floor and ceiling', () => {
    it('returns true when altitude is within bounds', () => {
      assert.equal(altitudeMatches(5000, msl(3000), msl(10000)), true);
    });

    it('returns true when altitude equals the floor', () => {
      assert.equal(altitudeMatches(3000, msl(3000), msl(10000)), true);
    });

    it('returns true when altitude equals the ceiling', () => {
      assert.equal(altitudeMatches(10000, msl(3000), msl(10000)), true);
    });

    it('returns false when altitude is below the floor', () => {
      assert.equal(altitudeMatches(2000, msl(3000), msl(10000)), false);
    });

    it('returns false when altitude is above the ceiling', () => {
      assert.equal(altitudeMatches(11000, msl(3000), msl(10000)), false);
    });
  });

  describe('SFC floor', () => {
    it('returns true for altitude at ground level', () => {
      assert.equal(altitudeMatches(0, sfc, msl(10000)), true);
    });

    it('returns true for altitude within SFC-to-ceiling range', () => {
      assert.equal(altitudeMatches(5000, sfc, msl(10000)), true);
    });

    it('returns false for altitude above ceiling', () => {
      assert.equal(altitudeMatches(15000, sfc, msl(10000)), false);
    });
  });

  describe('AGL bounds (conservative inclusion)', () => {
    it('includes when floor is AGL and altitude is above AGL value', () => {
      // Cannot resolve AGL, so floor check is skipped
      assert.equal(altitudeMatches(5000, agl(1000), msl(10000)), true);
    });

    it('includes when floor is AGL and altitude is below AGL value', () => {
      // Even though 500 < 1000 AGL, we cannot know the MSL equivalent,
      // so the floor check is skipped and the feature is included
      assert.equal(altitudeMatches(500, agl(1000), msl(10000)), true);
    });

    it('includes when ceiling is AGL', () => {
      assert.equal(altitudeMatches(5000, sfc, agl(3000)), true);
    });

    it('includes when both floor and ceiling are AGL', () => {
      assert.equal(altitudeMatches(5000, agl(1000), agl(3000)), true);
    });

    it('still excludes on MSL side when AGL on other side', () => {
      // Floor is MSL 8000, altitude is 5000 - excluded by the MSL floor
      assert.equal(altitudeMatches(5000, msl(8000), agl(15000)), false);
    });
  });

  describe('unlimited ceiling sentinel', () => {
    it('includes altitude below 99999 MSL sentinel', () => {
      assert.equal(altitudeMatches(45000, sfc, msl(99999)), true);
    });
  });

  describe('negative altitude', () => {
    it('excludes negative altitude when floor is SFC (resolved to 0)', () => {
      // SFC resolves to 0 ft MSL, so -100 is below the floor
      assert.equal(altitudeMatches(-100, sfc, msl(10000)), false);
    });

    it('excludes negative altitude when floor is MSL 0', () => {
      assert.equal(altitudeMatches(-100, msl(0), msl(10000)), false);
    });

    it('includes negative altitude when floor is AGL (conservative)', () => {
      // AGL floor cannot be resolved, so the check is skipped
      assert.equal(altitudeMatches(-100, agl(500), msl(10000)), true);
    });
  });
});
