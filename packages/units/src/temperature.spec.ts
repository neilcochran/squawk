import { describe, it } from 'node:test';
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
});
