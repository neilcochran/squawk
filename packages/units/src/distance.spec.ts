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
  haversineDistanceNm,
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

  describe('direct cross-unit conversions', () => {
    it('converts 1 nm to ~1.852 km directly', () => {
      assert.ok(close(nauticalMilesToKilometers(1), 1.852));
    });
    it('converts 100 km to ~53.99 nm directly', () => {
      assert.ok(close(kilometersToNauticalMiles(100), 53.99, 0.01));
    });
    it('converts 1 sm to ~1.609344 km directly', () => {
      assert.ok(close(statuteMilesToKilometers(1), 1.609344, 0.0001));
    });
    it('converts 50 km to ~31.07 sm directly', () => {
      assert.ok(close(kilometersToStatuteMiles(50), 31.07, 0.01));
    });
    it('converts 1 sm to ~1609.344 m directly', () => {
      assert.ok(close(statuteMilesToMeters(1), 1609.344, 0.001));
    });
    it('converts 5000 m to ~3.11 sm directly', () => {
      assert.ok(close(metersToStatuteMiles(5000), 3.11, 0.01));
    });
  });

  describe('zero value handling', () => {
    it('converts 0 nm to 0 km', () => {
      assert.equal(nauticalMilesToKilometers(0), 0);
    });
    it('converts 0 ft to 0 m', () => {
      assert.equal(feetToMeters(0), 0);
    });
    it('converts 0 km to 0 nm', () => {
      assert.equal(kilometersToNauticalMiles(0), 0);
    });
  });

  describe('reference values (immutable anchors)', () => {
    it('1 nautical mile equals exactly 1.852 km (definition)', () => {
      assert.equal(nauticalMilesToKilometers(1), 1.852);
    });
    it('1 statute mile equals exactly 5280 feet', () => {
      assert.equal(statuteMilesToFeet(1), 5280);
    });
  });

  describe('haversineDistanceNm', () => {
    it('returns 0 for the same point', () => {
      assert.equal(haversineDistanceNm(40.6413, -73.7781, 40.6413, -73.7781), 0);
    });

    it('computes JFK to LAX as approximately 2145 nm', () => {
      // JFK: 40.6413 N, 73.7781 W; LAX: 33.9425 N, 118.4081 W
      const dist = haversineDistanceNm(40.6413, -73.7781, 33.9425, -118.4081);
      assert.ok(close(dist, 2145, 5), `expected ~2145 nm, got ${dist}`);
    });

    it('computes a short distance accurately', () => {
      // JFK to LGA: approximately 10 nm
      const dist = haversineDistanceNm(40.6413, -73.7781, 40.7769, -73.874);
      assert.ok(dist > 5 && dist < 15, `expected ~10 nm, got ${dist}`);
    });

    it('is symmetric', () => {
      const d1 = haversineDistanceNm(40.6413, -73.7781, 33.9425, -118.4081);
      const d2 = haversineDistanceNm(33.9425, -118.4081, 40.6413, -73.7781);
      assert.equal(d1, d2);
    });
  });

  describe('critical physics constraint: Distance unit conversions preserve ordering', () => {
    it('larger nm value converts to larger km value', () => {
      const nm1 = 100;
      const nm2 = 200;
      const km1 = nauticalMilesToKilometers(nm1);
      const km2 = nauticalMilesToKilometers(nm2);
      assert.ok(km2 > km1, `${nm2} nm should be farther than ${nm1} nm`);
    });
    it('larger ft value converts to larger m value', () => {
      const ft1 = 1000;
      const ft2 = 2000;
      const m1 = feetToMeters(ft1);
      const m2 = feetToMeters(ft2);
      assert.ok(m2 > m1, `${ft2} ft should be farther than ${ft1} ft`);
    });
    it('larger sm value converts to larger ft value', () => {
      const sm1 = 1;
      const sm2 = 2;
      const ft1 = statuteMilesToFeet(sm1);
      const ft2 = statuteMilesToFeet(sm2);
      assert.ok(ft2 > ft1, `${sm2} sm should be farther than ${sm1} sm`);
    });
    it('distance unit chain: nm > km > m > ft (for equivalent distances)', () => {
      // 1 nautical mile = 1.852 km = 1852 m = ~6076 ft
      const nm = 1;
      const km = nauticalMilesToKilometers(nm);
      const m = nauticalMilesToMeters(nm);
      const ft = nauticalMilesToFeet(nm);
      assert.ok(nm < km, `1 nm should be numerically smaller than km (${km})`);
      assert.ok(km < m, `${km} km should be numerically smaller than m (${m})`);
      assert.ok(m < ft, `${m} m should be numerically smaller than ft (${ft})`);
    });
  });
});
