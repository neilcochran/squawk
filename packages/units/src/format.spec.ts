import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isFlightLevel,
  formatFlightLevel,
  formatAltitude,
  formatSpeed,
  formatQNH,
  formatDistance,
  formatTemperature,
} from './format.js';

describe('format utilities', () => {
  describe('isFlightLevel', () => {
    it('returns false below FL180 threshold', () => {
      assert.equal(isFlightLevel(17999), false);
    });
    it('returns true at exactly FL180 (18,000 ft)', () => {
      assert.equal(isFlightLevel(18000), true);
    });
    it('returns true above FL180', () => {
      assert.equal(isFlightLevel(35000), true);
    });
    it('returns false at 0 ft', () => {
      assert.equal(isFlightLevel(0), false);
    });
  });

  describe('formatFlightLevel', () => {
    it('formats 35000 ft as FL350', () => {
      assert.equal(formatFlightLevel(35000), 'FL350');
    });
    it('formats 8500 ft as FL085 (zero-padded)', () => {
      assert.equal(formatFlightLevel(8500), 'FL085');
    });
    it('formats 10000 ft as FL100', () => {
      assert.equal(formatFlightLevel(10000), 'FL100');
    });
    it('formats 18000 ft as FL180', () => {
      assert.equal(formatFlightLevel(18000), 'FL180');
    });
  });

  describe('formatAltitude', () => {
    it('formats 3500 ft as "3,500 ft"', () => {
      assert.equal(formatAltitude(3500), '3,500 ft');
    });
    it('formats 500 ft as "500 ft"', () => {
      assert.equal(formatAltitude(500), '500 ft');
    });
    it('formats 35000 ft as a flight level', () => {
      assert.equal(formatAltitude(35000), 'FL350');
    });
    it('formats 18000 ft as FL180', () => {
      assert.equal(formatAltitude(18000), 'FL180');
    });
    it('formats 17999 ft as "17,999 ft"', () => {
      assert.equal(formatAltitude(17999), '17,999 ft');
    });
  });

  describe('formatSpeed', () => {
    it('formats knots with no decimals', () => {
      assert.equal(formatSpeed(250, 'kt'), '250 kt');
    });
    it('formats Mach as "M0.82"', () => {
      assert.equal(formatSpeed(0.82, 'mach'), 'M0.82');
    });
    it('formats Mach with custom precision', () => {
      assert.equal(formatSpeed(0.8, 'mach', { precision: 1 }), 'M0.8');
    });
    it('formats km/h with no decimals', () => {
      assert.equal(formatSpeed(900, 'km/h'), '900 km/h');
    });
    it('formats m/s with one decimal by default', () => {
      assert.equal(formatSpeed(100, 'm/s'), '100.0 m/s');
    });
    it('formats mph with no decimals', () => {
      assert.equal(formatSpeed(130, 'mph'), '130 mph');
    });
  });

  describe('formatQNH', () => {
    it('formats inHg with two decimal places', () => {
      assert.equal(formatQNH(29.92, 'inHg'), '29.92 inHg');
    });
    it('formats hPa as an integer', () => {
      assert.equal(formatQNH(1013, 'hPa'), '1,013 hPa');
    });
    it('formats mmHg as an integer', () => {
      assert.equal(formatQNH(760, 'mmHg'), '760 mmHg');
    });
    it('respects precision override', () => {
      assert.equal(formatQNH(1013.25, 'hPa', { precision: 2 }), '1,013.25 hPa');
    });
  });

  describe('formatDistance', () => {
    it('formats nm with one decimal', () => {
      assert.equal(formatDistance(1.5, 'nm'), '1.5 nm');
    });
    it('formats km with one decimal', () => {
      assert.equal(formatDistance(2.3, 'km'), '2.3 km');
    });
    it('formats m with no decimals', () => {
      assert.equal(formatDistance(500, 'm'), '500 m');
    });
    it('formats ft with no decimals', () => {
      assert.equal(formatDistance(1000, 'ft'), '1,000 ft');
    });
    it('formats sm with one decimal', () => {
      assert.equal(formatDistance(3.0, 'sm'), '3.0 sm');
    });
  });

  describe('formatTemperature', () => {
    it('formats Celsius with degree symbol', () => {
      assert.equal(formatTemperature(15, 'C'), '15\u00B0C');
    });
    it('formats Fahrenheit with degree symbol', () => {
      assert.equal(formatTemperature(59, 'F'), '59\u00B0F');
    });
    it('formats Kelvin without degree symbol', () => {
      assert.equal(formatTemperature(288, 'K'), '288K');
    });
    it('appends ISA deviation when showISADeviation is true', () => {
      // ISA at 10,000 ft = 15 - 1.98122 * 10 = -4.81 C
      // OAT = 0 C -> deviation = 0 - (-4.81) = +5 (rounded)
      const result = formatTemperature(0, 'C', { showISADeviation: true, altitudeFt: 10000 });
      assert.ok(result.includes('ISA'), `expected ISA deviation in "${result}"`);
      assert.ok(result.startsWith('0\u00B0C'), `expected "0°C" prefix in "${result}"`);
    });
    it('shows negative ISA deviation for cold-of-standard conditions', () => {
      // ISA at sea level = 15 C. OAT = 10 C -> deviation = -5 ISA
      const result = formatTemperature(10, 'C', { showISADeviation: true, altitudeFt: 0 });
      assert.ok(result.includes('-5 ISA'), `expected "-5 ISA" in "${result}"`);
    });
    it('shows positive ISA deviation for warm-of-standard conditions', () => {
      // ISA at sea level = 15 C. OAT = 20 C -> deviation = +5 ISA
      const result = formatTemperature(20, 'C', { showISADeviation: true, altitudeFt: 0 });
      assert.ok(result.includes('+5 ISA'), `expected "+5 ISA" in "${result}"`);
    });
    it('does not show ISA deviation when showISADeviation is false', () => {
      const result = formatTemperature(15, 'C', { showISADeviation: false, altitudeFt: 0 });
      assert.ok(!result.includes('ISA'), `unexpected ISA deviation in "${result}"`);
    });
    it('does not show ISA deviation for non-Celsius units', () => {
      const result = formatTemperature(59, 'F', { showISADeviation: true, altitudeFt: 0 });
      assert.ok(!result.includes('ISA'), `unexpected ISA deviation in "${result}"`);
    });
  });
});
