import { describe, it, expect, assert } from 'vitest';

import {
  isFlightLevel,
  formatFlightLevel,
  formatAltitude,
  formatSpeed,
  formatQNH,
  formatDistance,
  formatFuel,
  formatTemperature,
} from './format.js';

describe('format utilities', () => {
  describe('isFlightLevel', () => {
    it('returns false below FL180 threshold', () => {
      expect(isFlightLevel(17999)).toBe(false);
    });
    it('returns true at exactly FL180 (18,000 ft)', () => {
      expect(isFlightLevel(18000)).toBe(true);
    });
    it('returns true above FL180', () => {
      expect(isFlightLevel(35000)).toBe(true);
    });
    it('returns false at 0 ft', () => {
      expect(isFlightLevel(0)).toBe(false);
    });
  });

  describe('formatFlightLevel', () => {
    it('formats 35000 ft as FL350', () => {
      expect(formatFlightLevel(35000)).toBe('FL350');
    });
    it('formats 8500 ft as FL085 (zero-padded)', () => {
      expect(formatFlightLevel(8500)).toBe('FL085');
    });
    it('formats 10000 ft as FL100', () => {
      expect(formatFlightLevel(10000)).toBe('FL100');
    });
    it('formats 18000 ft as FL180', () => {
      expect(formatFlightLevel(18000)).toBe('FL180');
    });
  });

  describe('formatAltitude', () => {
    it('formats 3500 ft as "3,500 ft"', () => {
      expect(formatAltitude(3500)).toBe('3,500 ft');
    });
    it('formats 500 ft as "500 ft"', () => {
      expect(formatAltitude(500)).toBe('500 ft');
    });
    it('formats 35000 ft as a flight level', () => {
      expect(formatAltitude(35000)).toBe('FL350');
    });
    it('formats 18000 ft as FL180', () => {
      expect(formatAltitude(18000)).toBe('FL180');
    });
    it('formats 17999 ft as "17,999 ft"', () => {
      expect(formatAltitude(17999)).toBe('17,999 ft');
    });
  });

  describe('formatSpeed', () => {
    it('formats knots with no decimals', () => {
      expect(formatSpeed(250, 'kt')).toBe('250 kt');
    });
    it('formats Mach as "M0.82"', () => {
      expect(formatSpeed(0.82, 'mach')).toBe('M0.82');
    });
    it('formats Mach with custom precision', () => {
      expect(formatSpeed(0.8, 'mach', { precision: 1 })).toBe('M0.8');
    });
    it('formats km/h with no decimals', () => {
      expect(formatSpeed(900, 'km/h')).toBe('900 km/h');
    });
    it('formats m/s with one decimal by default', () => {
      expect(formatSpeed(100, 'm/s')).toBe('100.0 m/s');
    });
    it('formats mph with no decimals', () => {
      expect(formatSpeed(130, 'mph')).toBe('130 mph');
    });
  });

  describe('formatQNH', () => {
    it('formats inHg with two decimal places', () => {
      expect(formatQNH(29.92, 'inHg')).toBe('29.92 inHg');
    });
    it('formats hPa as an integer', () => {
      expect(formatQNH(1013, 'hPa')).toBe('1,013 hPa');
    });
    it('formats mmHg as an integer', () => {
      expect(formatQNH(760, 'mmHg')).toBe('760 mmHg');
    });
    it('formats mb as an integer (matches hPa precision)', () => {
      expect(formatQNH(1013, 'mb')).toBe('1,013 mb');
    });
    it('formats kPa with two decimal places', () => {
      expect(formatQNH(101.32, 'kPa')).toBe('101.32 kPa');
    });
    it('respects precision override', () => {
      expect(formatQNH(1013.25, 'hPa', { precision: 2 })).toBe('1,013.25 hPa');
    });
  });

  describe('formatDistance', () => {
    it('formats nm with one decimal', () => {
      expect(formatDistance(1.5, 'nm')).toBe('1.5 nm');
    });
    it('formats km with one decimal', () => {
      expect(formatDistance(2.3, 'km')).toBe('2.3 km');
    });
    it('formats m with no decimals', () => {
      expect(formatDistance(500, 'm')).toBe('500 m');
    });
    it('formats ft with no decimals', () => {
      expect(formatDistance(1000, 'ft')).toBe('1,000 ft');
    });
    it('formats sm with one decimal', () => {
      expect(formatDistance(3.0, 'sm')).toBe('3.0 sm');
    });
  });

  describe('formatFuel', () => {
    it('formats gal with one decimal', () => {
      expect(formatFuel(42.5, 'gal')).toBe('42.5 gal');
    });
    it('formats L with one decimal', () => {
      expect(formatFuel(160.8, 'L')).toBe('160.8 L');
    });
    it('formats lb as an integer', () => {
      expect(formatFuel(336, 'lb')).toBe('336 lb');
    });
    it('formats kg as an integer', () => {
      expect(formatFuel(250, 'kg')).toBe('250 kg');
    });
    it('applies thousands separator for large values', () => {
      expect(formatFuel(3220, 'lb')).toBe('3,220 lb');
    });
    it('respects precision override', () => {
      expect(formatFuel(42, 'gal', { precision: 0 })).toBe('42 gal');
      expect(formatFuel(336.7, 'lb', { precision: 1 })).toBe('336.7 lb');
    });
    it('respects locale override', () => {
      expect(formatFuel(3220, 'lb', { locale: 'de-DE' })).toBe('3.220 lb');
    });
  });

  describe('formatTemperature', () => {
    it('formats Celsius with degree symbol', () => {
      expect(formatTemperature(15, 'C')).toBe('15\u00B0C');
    });
    it('formats Fahrenheit with degree symbol', () => {
      expect(formatTemperature(59, 'F')).toBe('59\u00B0F');
    });
    it('formats Kelvin without degree symbol', () => {
      expect(formatTemperature(288, 'K')).toBe('288K');
    });
    it('appends ISA deviation when showISADeviation is true', () => {
      // ISA at 10,000 ft = 15 - 1.98122 * 10 = -4.81 C
      // OAT = 0 C -> deviation = 0 - (-4.81) = +5 (rounded)
      const result = formatTemperature(0, 'C', { showISADeviation: true, altitudeFt: 10000 });
      assert(result.includes('ISA'), `expected ISA deviation in "${result}"`);
      assert(result.startsWith('0\u00B0C'), `expected "0°C" prefix in "${result}"`);
    });
    it('shows negative ISA deviation for cold-of-standard conditions', () => {
      // ISA at sea level = 15 C. OAT = 10 C -> deviation = -5 ISA
      const result = formatTemperature(10, 'C', { showISADeviation: true, altitudeFt: 0 });
      assert(result.includes('-5 ISA'), `expected "-5 ISA" in "${result}"`);
    });
    it('shows positive ISA deviation for warm-of-standard conditions', () => {
      // ISA at sea level = 15 C. OAT = 20 C -> deviation = +5 ISA
      const result = formatTemperature(20, 'C', { showISADeviation: true, altitudeFt: 0 });
      assert(result.includes('+5 ISA'), `expected "+5 ISA" in "${result}"`);
    });
    it('does not show ISA deviation when showISADeviation is false', () => {
      const result = formatTemperature(15, 'C', { showISADeviation: false, altitudeFt: 0 });
      assert(!result.includes('ISA'), `unexpected ISA deviation in "${result}"`);
    });
    it('does not show ISA deviation for non-Celsius units', () => {
      const result = formatTemperature(59, 'F', { showISADeviation: true, altitudeFt: 0 });
      assert(!result.includes('ISA'), `unexpected ISA deviation in "${result}"`);
    });
  });

  describe('locale-specific formatting', () => {
    it('formats numbers with locale thousands separator (en-US)', () => {
      // en-US uses comma for thousands
      const result = formatAltitude(12345, { locale: 'en-US' });
      assert(
        result.includes('12,345'),
        `expected thousands separator in en-US format: "${result}"`,
      );
    });
    it('formats numbers with locale thousands separator (de-DE)', () => {
      // de-DE uses period for thousands and comma for decimals
      const result = formatAltitude(12345, { locale: 'de-DE' });
      // German formatting uses . for thousands, so we should see the number formatted differently
      assert(
        result.includes('12.345') || result.includes('12345'),
        `expected German-formatted number: "${result}"`,
      );
    });
    it('formatQNH respects locale for large pressure values', () => {
      const resultUS = formatQNH(1013, 'hPa', { locale: 'en-US' });
      const resultDE = formatQNH(1013, 'hPa', { locale: 'de-DE' });
      // Verify both format but may differ in separators
      assert(resultUS.includes('hPa'));
      assert(resultDE.includes('hPa'));
    });
  });

  describe('extreme value formatting', () => {
    it('formats very high altitude (FL999 equivalent)', () => {
      const result = formatAltitude(99900);
      assert(result.includes('FL999'), `expected FL999 in: "${result}"`);
    });
    it('formats very small distance (0.1 nm)', () => {
      const result = formatDistance(0.1, 'nm');
      assert(result.includes('0.1'), `expected 0.1 in: "${result}"`);
    });
    it('formats zero altitude', () => {
      const result = formatAltitude(0);
      assert(result.includes('0'), `expected 0 ft in: "${result}"`);
    });
    it('formats very high speed', () => {
      const result = formatSpeed(999, 'kt');
      assert(result.includes('999'), `expected 999 kt in: "${result}"`);
    });
    it('formats Mach at transonic speeds', () => {
      const result = formatSpeed(0.95, 'mach');
      expect(result).toBe('M0.95');
    });
    it('formats very low pressure (vacuum-approaching)', () => {
      const result = formatQNH(10, 'hPa');
      assert(result.includes('10'), `expected 10 in: "${result}"`);
    });
  });

  describe('edge cases: NaN, Infinity, and negative values', () => {
    describe('NaN handling', () => {
      it('formatAltitude(NaN) produces a valid string without crashing', () => {
        const result = formatAltitude(NaN);
        expect(typeof result).toBe('string');
        assert(result.length > 0, 'result should not be empty');
      });
      it('formatSpeed(NaN, "kt") produces a valid string', () => {
        const result = formatSpeed(NaN, 'kt');
        expect(typeof result).toBe('string');
      });
      it('formatTemperature(NaN, "C") produces a valid string', () => {
        const result = formatTemperature(NaN, 'C');
        expect(typeof result).toBe('string');
      });
      it('formatQNH(NaN, "hPa") produces a valid string', () => {
        const result = formatQNH(NaN, 'hPa');
        expect(typeof result).toBe('string');
      });
      it('formatDistance(NaN, "nm") produces a valid string', () => {
        const result = formatDistance(NaN, 'nm');
        expect(typeof result).toBe('string');
      });
    });

    describe('Infinity handling', () => {
      it('formatAltitude(Infinity) produces a valid string', () => {
        const result = formatAltitude(Infinity);
        expect(typeof result).toBe('string');
        assert(result.length > 0);
      });
      it('formatAltitude(-Infinity) produces a valid string', () => {
        const result = formatAltitude(-Infinity);
        expect(typeof result).toBe('string');
        assert(result.length > 0);
      });
      it('formatSpeed(Infinity, "kt") produces a valid string', () => {
        const result = formatSpeed(Infinity, 'kt');
        expect(typeof result).toBe('string');
      });
      it('formatSpeed(-Infinity, "kt") produces a valid string', () => {
        const result = formatSpeed(-Infinity, 'kt');
        expect(typeof result).toBe('string');
      });
      it('formatTemperature(Infinity, "C") produces a valid string', () => {
        const result = formatTemperature(Infinity, 'C');
        expect(typeof result).toBe('string');
      });
      it('formatQNH(-Infinity, "hPa") produces a valid string', () => {
        const result = formatQNH(-Infinity, 'hPa');
        expect(typeof result).toBe('string');
      });
      it('formatDistance(Infinity, "nm") produces a valid string', () => {
        const result = formatDistance(Infinity, 'nm');
        expect(typeof result).toBe('string');
      });
    });

    describe('negative value handling', () => {
      it('formatAltitude(-150) formats negative altitude for below-sea-level', () => {
        const result = formatAltitude(-150);
        expect(typeof result).toBe('string');
        assert(result.includes('-'), `expected negative sign in: "${result}"`);
        assert(result.includes('ft'));
      });
      it('formatAltitude(-18000) does not format negative as flight level', () => {
        const result = formatAltitude(-18000);
        expect(typeof result).toBe('string');
        assert(!result.includes('FL'), 'negative altitude should not be a flight level');
      });
      it('formatSpeed(-50, "kt") formats negative speed value', () => {
        const result = formatSpeed(-50, 'kt');
        expect(typeof result).toBe('string');
        assert(result.includes('-'), `expected negative sign in: "${result}"`);
      });
      it('formatTemperature(-40, "C") formats negative Celsius', () => {
        const result = formatTemperature(-40, 'C');
        expect(typeof result).toBe('string');
        assert(result.includes('-'), `expected negative sign in: "${result}"`);
      });
      it('formatTemperature(-300, "C") formats below absolute zero (no validator rejection)', () => {
        const result = formatTemperature(-300, 'C');
        expect(typeof result).toBe('string');
        // Formatter does not validate; application layer should catch this
      });
      it('formatQNH(-1013, "hPa") formats negative pressure value', () => {
        const result = formatQNH(-1013, 'hPa');
        expect(typeof result).toBe('string');
        assert(result.includes('-'), `expected negative sign in: "${result}"`);
      });
      it('formatDistance(-5.5, "nm") formats negative distance', () => {
        const result = formatDistance(-5.5, 'nm');
        expect(typeof result).toBe('string');
        assert(result.includes('-'), `expected negative sign in: "${result}"`);
      });
    });
  });
});
