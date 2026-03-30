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
});
