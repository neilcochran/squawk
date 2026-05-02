import { describe, it, expect, assert } from 'vitest';
import { close } from './test-utils.js';
import {
  knotsToKilometersPerHour,
  kilometersPerHourToKnots,
  knotsToMilesPerHour,
  milesPerHourToKnots,
  knotsToMetersPerSecond,
  metersPerSecondToKnots,
  kilometersPerHourToMilesPerHour,
  milesPerHourToKilometersPerHour,
  kilometersPerHourToMetersPerSecond,
  metersPerSecondToKilometersPerHour,
  milesPerHourToMetersPerSecond,
  metersPerSecondToMilesPerHour,
} from './speed.js';

describe('speed conversions', () => {
  describe('knotsToKilometersPerHour', () => {
    it('converts 1 kt to 1.852 km/h (exact definition)', () => {
      expect(knotsToKilometersPerHour(1)).toBe(1.852);
    });
    it('converts 0 kt to 0 km/h', () => {
      expect(knotsToKilometersPerHour(0)).toBe(0);
    });
    it('converts 250 kt', () => {
      expect(knotsToKilometersPerHour(250)).toBe(463);
    });
  });

  describe('kilometersPerHourToKnots', () => {
    it('is the inverse of knotsToKilometersPerHour', () => {
      assert(close(kilometersPerHourToKnots(knotsToKilometersPerHour(250)), 250));
    });
    it('converts 1.852 km/h to 1 kt', () => {
      assert(close(kilometersPerHourToKnots(1.852), 1));
    });
  });

  describe('knotsToMilesPerHour', () => {
    it('converts 1 kt to ~1.15078 mph', () => {
      assert(close(knotsToMilesPerHour(1), 1.15078));
    });
    it('converts 0 kt to 0 mph', () => {
      expect(knotsToMilesPerHour(0)).toBe(0);
    });
    it('converts 100 kt to ~115.078 mph', () => {
      assert(close(knotsToMilesPerHour(100), 115.078, 0.01));
    });
  });

  describe('milesPerHourToKnots', () => {
    it('converts 115.078 mph to ~100 kt', () => {
      assert(close(milesPerHourToKnots(115.078), 100, 0.01));
    });
    it('is the inverse of knotsToMilesPerHour', () => {
      assert(close(milesPerHourToKnots(knotsToMilesPerHour(100)), 100));
    });
  });

  describe('knotsToMetersPerSecond', () => {
    it('converts 1 kt to ~0.514444 m/s', () => {
      assert(close(knotsToMetersPerSecond(1), 0.514444));
    });
    it('converts 0 kt to 0 m/s', () => {
      expect(knotsToMetersPerSecond(0)).toBe(0);
    });
  });

  describe('metersPerSecondToKnots', () => {
    it('converts 0.514444 m/s to 1 kt', () => {
      assert(close(metersPerSecondToKnots(0.514444), 1));
    });
    it('is the inverse of knotsToMetersPerSecond', () => {
      assert(close(metersPerSecondToKnots(knotsToMetersPerSecond(200)), 200));
    });
  });

  describe('kilometersPerHourToMilesPerHour', () => {
    it('converts 100 km/h to ~62.137 mph', () => {
      assert(close(kilometersPerHourToMilesPerHour(100), 62.137, 0.01));
    });
  });

  describe('milesPerHourToKilometersPerHour', () => {
    it('converts 100 mph to 160.9344 km/h', () => {
      assert(close(milesPerHourToKilometersPerHour(100), 160.9344, 0.001));
    });
    it('is the inverse of kilometersPerHourToMilesPerHour', () => {
      assert(close(milesPerHourToKilometersPerHour(kilometersPerHourToMilesPerHour(100)), 100));
    });
  });

  describe('kilometersPerHourToMetersPerSecond', () => {
    it('converts 3600 km/h to 1000 m/s', () => {
      assert(close(kilometersPerHourToMetersPerSecond(3600), 1000));
    });
    it('converts 0 to 0', () => {
      expect(kilometersPerHourToMetersPerSecond(0)).toBe(0);
    });
  });

  describe('metersPerSecondToKilometersPerHour', () => {
    it('is the inverse of kilometersPerHourToMetersPerSecond', () => {
      assert(
        close(metersPerSecondToKilometersPerHour(kilometersPerHourToMetersPerSecond(300)), 300),
      );
    });
  });

  describe('milesPerHourToMetersPerSecond', () => {
    it('converts 1 mph to ~0.44704 m/s', () => {
      assert(close(milesPerHourToMetersPerSecond(1), 0.44704));
    });
  });

  describe('metersPerSecondToMilesPerHour', () => {
    it('converts 0.44704 m/s to 1 mph', () => {
      assert(close(metersPerSecondToMilesPerHour(0.44704), 1));
    });
    it('is the inverse of milesPerHourToMetersPerSecond', () => {
      assert(close(metersPerSecondToMilesPerHour(milesPerHourToMetersPerSecond(60)), 60));
    });
  });

  describe('reference values (immutable anchors)', () => {
    it('1 knot equals exactly 1.852 km/h (definition)', () => {
      expect(knotsToKilometersPerHour(1)).toBe(1.852);
    });
    it('Mach 1.0 at sea level equals ~661.47 knots', () => {
      // Speed of sound at ISA sea level 15°C
      assert(close(knotsToMetersPerSecond(661.4788), 340.29, 0.1));
    });
  });

  describe('critical physics constraint: Speed unit conversions preserve ordering', () => {
    it('larger kt value converts to larger km/h value', () => {
      const kts1 = 100;
      const kts2 = 200;
      const kmh1 = knotsToKilometersPerHour(kts1);
      const kmh2 = knotsToKilometersPerHour(kts2);
      assert(kmh2 > kmh1, `${kts2} kt should convert to faster km/h than ${kts1} kt`);
    });
    it('larger kt value converts to larger mph value', () => {
      const kts1 = 100;
      const kts2 = 200;
      const mph1 = knotsToMilesPerHour(kts1);
      const mph2 = knotsToMilesPerHour(kts2);
      assert(mph2 > mph1, `${kts2} kt should convert to faster mph than ${kts1} kt`);
    });
    it('larger kt value converts to larger m/s value', () => {
      const kts1 = 100;
      const kts2 = 200;
      const ms1 = knotsToMetersPerSecond(kts1);
      const ms2 = knotsToMetersPerSecond(kts2);
      assert(ms2 > ms1, `${kts2} kt should convert to faster m/s than ${kts1} kt`);
    });
  });
});
