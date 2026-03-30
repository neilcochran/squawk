import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import {
  nauticalMilesToKilometers,
  kilometersToNauticalMiles,
  nauticalMilesToStatuteMiles,
  statuteMilesToNauticalMiles,
  nauticalMilesToMeters,
  metersToNauticalMiles,
  nauticalMilesToFeet,
  feetToNauticalMiles,
  kilometersToStatuteMiles,
  statuteMilesToKilometers,
  kilometersToMeters,
  metersToKilometers,
  kilometersToFeet,
  feetToKilometers,
  statuteMilesToMeters,
  metersToStatuteMiles,
  statuteMilesToFeet,
  feetToStatuteMiles,
  feetToMeters,
  metersToFeet,
} from './distance.js';

describe('distance conversions', () => {
  describe('nauticalMilesToKilometers / kilometersToNauticalMiles', () => {
    it('converts 1 nm to 1.852 km (exact definition)', () => {
      assert.equal(nauticalMilesToKilometers(1), 1.852);
    });
    it('is invertible', () => {
      assert.ok(close(kilometersToNauticalMiles(nauticalMilesToKilometers(10)), 10));
    });
  });

  describe('nauticalMilesToStatuteMiles / statuteMilesToNauticalMiles', () => {
    it('converts 1 nm to ~1.15078 sm', () => {
      assert.ok(close(nauticalMilesToStatuteMiles(1), 1.15078));
    });
    it('is invertible', () => {
      assert.ok(close(statuteMilesToNauticalMiles(nauticalMilesToStatuteMiles(50)), 50));
    });
  });

  describe('nauticalMilesToMeters / metersToNauticalMiles', () => {
    it('converts 1 nm to 1852 m (exact definition)', () => {
      assert.equal(nauticalMilesToMeters(1), 1852);
    });
    it('is invertible', () => {
      assert.ok(close(metersToNauticalMiles(nauticalMilesToMeters(5)), 5));
    });
  });

  describe('nauticalMilesToFeet / feetToNauticalMiles', () => {
    it('converts 1 nm to ~6076 ft', () => {
      assert.ok(close(nauticalMilesToFeet(1), 6076.115, 0.01));
    });
    it('is invertible', () => {
      assert.ok(close(feetToNauticalMiles(nauticalMilesToFeet(3)), 3));
    });
  });

  describe('kilometersToStatuteMiles / statuteMilesToKilometers', () => {
    it('converts 1 km to ~0.62137 sm', () => {
      assert.ok(close(kilometersToStatuteMiles(1), 0.62137, 0.001));
    });
    it('converts 1 sm to 1.609344 km', () => {
      assert.ok(close(statuteMilesToKilometers(1), 1.609344, 0.0001));
    });
    it('is invertible', () => {
      assert.ok(close(statuteMilesToKilometers(kilometersToStatuteMiles(100)), 100));
    });
  });

  describe('kilometersToMeters / metersToKilometers', () => {
    it('converts 1 km to 1000 m', () => {
      assert.equal(kilometersToMeters(1), 1000);
    });
    it('converts 1000 m to 1 km', () => {
      assert.equal(metersToKilometers(1000), 1);
    });
  });

  describe('kilometersToFeet / feetToKilometers', () => {
    it('converts 1 km to ~3280.84 ft', () => {
      assert.ok(close(kilometersToFeet(1), 3280.84, 0.01));
    });
    it('is invertible', () => {
      assert.ok(close(feetToKilometers(kilometersToFeet(10)), 10));
    });
  });

  describe('statuteMilesToMeters / metersToStatuteMiles', () => {
    it('converts 1 sm to 1609.344 m (exact)', () => {
      assert.equal(statuteMilesToMeters(1), 1609.344);
    });
    it('is invertible', () => {
      assert.ok(close(metersToStatuteMiles(statuteMilesToMeters(5)), 5));
    });
  });

  describe('statuteMilesToFeet / feetToStatuteMiles', () => {
    it('converts 1 sm to 5280 ft (exact)', () => {
      assert.equal(statuteMilesToFeet(1), 5280);
    });
    it('is invertible', () => {
      assert.ok(close(feetToStatuteMiles(statuteMilesToFeet(2)), 2));
    });
  });

  describe('feetToMeters / metersToFeet', () => {
    it('converts 1 ft to 0.3048 m (exact definition)', () => {
      assert.equal(feetToMeters(1), 0.3048);
    });
    it('converts 1 m to ~3.28084 ft', () => {
      assert.ok(close(metersToFeet(1), 3.28084, 0.0001));
    });
    it('is invertible', () => {
      assert.ok(close(metersToFeet(feetToMeters(1000)), 1000));
    });
  });
});
