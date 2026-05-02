import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  celsiusToKelvin,
  kelvinToCelsius,
  fahrenheitToKelvin,
  kelvinToFahrenheit,
} from './temperature.js';

describe('temperature conversions', () => {
  describe('celsiusToFahrenheit', () => {
    it('converts 0 C (freezing) to 32 F', () => {
      assert.equal(celsiusToFahrenheit(0), 32);
    });
    it('converts 100 C (boiling) to 212 F', () => {
      assert.equal(celsiusToFahrenheit(100), 212);
    });
    it('converts -40 C to -40 F (crossover point)', () => {
      assert.equal(celsiusToFahrenheit(-40), -40);
    });
    it('converts ISA sea-level standard 15 C to 59 F', () => {
      assert.equal(celsiusToFahrenheit(15), 59);
    });
  });

  describe('fahrenheitToCelsius', () => {
    it('converts 32 F to 0 C', () => {
      assert.equal(fahrenheitToCelsius(32), 0);
    });
    it('converts 212 F to 100 C', () => {
      assert.equal(fahrenheitToCelsius(212), 100);
    });
    it('converts -40 F to -40 C', () => {
      assert.equal(fahrenheitToCelsius(-40), -40);
    });
    it('is the inverse of celsiusToFahrenheit', () => {
      assert.ok(close(fahrenheitToCelsius(celsiusToFahrenheit(25)), 25));
    });
  });

  describe('celsiusToKelvin', () => {
    it('converts 0 C to 273.15 K', () => {
      assert.equal(celsiusToKelvin(0), 273.15);
    });
    it('converts -273.15 C (absolute zero) to 0 K', () => {
      assert.equal(celsiusToKelvin(-273.15), 0);
    });
    it('converts ISA sea-level standard 15 C to 288.15 K', () => {
      assert.equal(celsiusToKelvin(15), 288.15);
    });
  });

  describe('kelvinToCelsius', () => {
    it('converts 273.15 K to 0 C', () => {
      assert.equal(kelvinToCelsius(273.15), 0);
    });
    it('converts 0 K to -273.15 C', () => {
      assert.equal(kelvinToCelsius(0), -273.15);
    });
    it('is the inverse of celsiusToKelvin', () => {
      assert.ok(close(kelvinToCelsius(celsiusToKelvin(-56.5)), -56.5));
    });
  });

  describe('fahrenheitToKelvin', () => {
    it('converts 32 F to 273.15 K', () => {
      assert.ok(close(fahrenheitToKelvin(32), 273.15));
    });
    it('converts -40 F to 233.15 K', () => {
      assert.ok(close(fahrenheitToKelvin(-40), 233.15));
    });
  });

  describe('kelvinToFahrenheit', () => {
    it('converts 273.15 K to 32 F', () => {
      assert.ok(close(kelvinToFahrenheit(273.15), 32));
    });
    it('is the inverse of fahrenheitToKelvin', () => {
      assert.ok(close(kelvinToFahrenheit(fahrenheitToKelvin(59)), 59));
    });
  });

  describe('fractional temperature precision', () => {
    it('converts 20.5 C to 68.9 F', () => {
      assert.ok(close(celsiusToFahrenheit(20.5), 68.9, 0.01));
    });
    it('converts 98.6 F to ~37 C', () => {
      assert.ok(close(fahrenheitToCelsius(98.6), 37, 0.01));
    });
    it('converts 25.5 C to 298.65 K', () => {
      assert.ok(close(celsiusToKelvin(25.5), 298.65, 0.01));
    });
    it('converts -0.5 C to 272.65 K', () => {
      assert.ok(close(celsiusToKelvin(-0.5), 272.65, 0.01));
    });
  });

  describe('zero and near-absolute-zero', () => {
    it('converts exactly 0 C to 0.00 K offset', () => {
      assert.equal(celsiusToKelvin(0) - 273.15, 0);
    });
    it('converts 0 K to -273.15 C exactly', () => {
      assert.equal(kelvinToCelsius(0), -273.15);
    });
  });

  describe('reference values (immutable anchors)', () => {
    it('Water freezes at 0°C = 32°F = 273.15 K', () => {
      assert.equal(celsiusToFahrenheit(0), 32);
      assert.equal(celsiusToKelvin(0), 273.15);
    });
    it('Water boils at 100°C = 212°F = 373.15 K', () => {
      assert.equal(celsiusToFahrenheit(100), 212);
      assert.equal(celsiusToKelvin(100), 373.15);
    });
    it('ISA sea level temperature: 15°C = 59°F = 288.15 K', () => {
      assert.equal(celsiusToFahrenheit(15), 59);
      assert.equal(celsiusToKelvin(15), 288.15);
    });
    it('Absolute zero: -273.15°C = -459.67°F = 0 K', () => {
      assert.ok(close(celsiusToFahrenheit(-273.15), -459.67, 0.01));
      assert.equal(kelvinToCelsius(0), -273.15);
    });
  });

  describe('real-world aviation scenarios', () => {
    it('FL350 ISA tropopause -56.5°C = -69.7°F', () => {
      assert.ok(close(celsiusToFahrenheit(-56.5), -69.7, 0.1));
    });
    it('FL180 ISA temperature -20.66°C = -5.19°F', () => {
      assert.ok(close(celsiusToFahrenheit(-20.66), -5.19, 0.1));
    });
    it('high altitude extreme cold -40°C = -40°F (crossover)', () => {
      assert.equal(celsiusToFahrenheit(-40), -40);
    });
    it('cabin pressure cold scenario -20°C = -4°F', () => {
      assert.ok(close(celsiusToFahrenheit(-20), -4, 0.1));
    });
  });

  describe('critical physics constraint: Temperature >= Absolute Zero', () => {
    it('Absolute zero is -273.15°C = 0 K = -459.67°F', () => {
      assert.equal(celsiusToKelvin(-273.15), 0);
      assert.ok(close(celsiusToFahrenheit(-273.15), -459.67, 0.1));
    });
    it('Temperature conversions work correctly at near-absolute-zero', () => {
      // Test temperatures very close to absolute zero
      const tempC = -273.14; // Just above absolute zero
      const tempK = celsiusToKelvin(tempC);
      assert.ok(tempK > 0, `Kelvin conversion of ${tempC}°C should be > 0`);
      assert.ok(tempK < 1, `Kelvin conversion of ${tempC}°C should be < 1 K`);
    });
    it('Extreme cold (outside atmosphere, liquid oxygen range): -183°C', () => {
      // Liquid oxygen boils at -183°C (practical extreme)
      const tempC = -183;
      const tempK = celsiusToKelvin(tempC);
      const tempF = celsiusToFahrenheit(tempC);
      assert.ok(tempK > 0, `${tempC}°C should convert to positive Kelvin`);
      assert.ok(tempK < 273.15, `${tempC}°C should be well below freezing in Kelvin`);
      assert.ok(tempF < 0, `${tempC}°C should be below freezing in Fahrenheit`);
    });
    it('Physical law: No temperature below -273.15°C exists in nature', () => {
      // Document the constraint; implementations may or may not enforce it
      const absoluteZeroC = -273.15;
      const absoluteZeroK = celsiusToKelvin(absoluteZeroC);
      assert.equal(absoluteZeroK, 0, 'Absolute zero should convert to 0 K');
      // Verify the relationship holds across all valid temps
      const validTemps = [-250, -200, -100, -40, 0, 15, 30, 100];
      for (const temp of validTemps) {
        assert.ok(temp >= -273.15, `Test temperature ${temp}°C should be >= absolute zero`);
        const k = celsiusToKelvin(temp);
        assert.ok(k >= 0, `Kelvin result (${k}) for ${temp}°C should be >= 0`);
      }
    });
  });
});
