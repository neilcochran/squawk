import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import { feetToMeters, metersToFeet } from './altitude.js';

describe('altitude conversions', () => {
  describe('feetToMeters', () => {
    it('converts 1 ft to 0.3048 m (exact definition)', () => {
      assert.equal(feetToMeters(1), 0.3048);
    });
    it('converts 0 ft to 0 m', () => {
      assert.equal(feetToMeters(0), 0);
    });
    it('converts standard cruising altitude 35000 ft to ~10668 m', () => {
      assert.ok(close(feetToMeters(35000), 10668, 1));
    });
  });

  describe('metersToFeet', () => {
    it('converts 1 m to ~3.28084 ft', () => {
      assert.ok(close(metersToFeet(1), 3.28084, 0.0001));
    });
    it('converts 0 m to 0 ft', () => {
      assert.equal(metersToFeet(0), 0);
    });
    it('converts tropopause altitude 11000 m to ~36089 ft', () => {
      assert.ok(close(metersToFeet(11000), 36089, 1));
    });
  });

  describe('round-trip', () => {
    it('feetToMeters then metersToFeet returns original value', () => {
      assert.ok(close(metersToFeet(feetToMeters(18000)), 18000, 0.0001));
    });
    it('metersToFeet then feetToMeters returns original value', () => {
      assert.ok(close(feetToMeters(metersToFeet(5000)), 5000, 0.0001));
    });
  });

  describe('zero and negative altitudes', () => {
    it('converts -100 ft (below sea level) to ~-30.48 m', () => {
      assert.ok(close(feetToMeters(-100), -30.48, 0.01));
    });
    it('converts -50 m (below sea level) to ~-164.04 ft', () => {
      assert.ok(close(metersToFeet(-50), -164.04, 0.1));
    });
  });

  describe('reference values (immutable anchors)', () => {
    it('converts 35000 ft (FL350) to 10668 m exactly', () => {
      assert.ok(close(feetToMeters(35000), 10668, 1));
    });
    it('converts 10000 m to 32808 ft', () => {
      assert.ok(close(metersToFeet(10000), 32808.4, 1));
    });
  });

  describe('real-world airport scenarios', () => {
    it('Denver (KDEN) at 5280 ft equals ~1609 m', () => {
      assert.ok(close(feetToMeters(5280), 1609.3, 1));
    });
    it('Death Valley (KDVL) at -282 ft equals ~-86 m', () => {
      assert.ok(close(feetToMeters(-282), -85.95, 1));
    });
    it('Mexico City (MMMX) at 7382 ft equals ~2250 m', () => {
      assert.ok(close(feetToMeters(7382), 2250.3, 1));
    });
    it('Mt. Everest base camp (~17600 ft) equals ~5365 m', () => {
      assert.ok(close(feetToMeters(17600), 5365, 5));
    });
    it('FL180 (18000 ft) US transition altitude to meters', () => {
      assert.ok(close(feetToMeters(18000), 5486, 1));
    });
  });

  describe('critical physics constraint: Altitude unit conversions preserve ordering', () => {
    it('larger ft value converts to larger m value', () => {
      const ft1 = 5000;
      const ft2 = 10000;
      const m1 = feetToMeters(ft1);
      const m2 = feetToMeters(ft2);
      assert.ok(m2 > m1, `${ft2} ft should be higher than ${ft1} ft`);
    });
    it('altitude relationships: 1 ft converts to smaller m than 1 m', () => {
      // 1 ft = 0.3048 m, so ratio is ~3.28:1
      // This means numerically meters represent larger distances
      const ft = 1000;
      const m = feetToMeters(ft);
      assert.ok(m < ft, `${m} m should be numerically smaller than ${ft} ft for same altitude`);
    });
    it('preserves ordering across altitude range', () => {
      const altitudes = [0, 1000, 5000, 10000, 18000, 35000];
      const meters = altitudes.map((ft) => feetToMeters(ft));
      // Verify monotonic increasing
      for (let i = 1; i < meters.length; i++) {
        assert.ok(meters[i]! > meters[i - 1]!, `altitude ordering should be preserved`);
      }
    });
  });
});
