import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import {
  isaTemperatureCelsius,
  pressureAtAltitudeHectopascals,
  densityAltitudeFeet,
  speedOfSoundKnots,
  tasFromCasKnots,
  machFromTasKnots,
  tasFromMachKnots,
  ISA_SEA_LEVEL_TEMP_C,
  ISA_SEA_LEVEL_PRESSURE_HPA,
  ISA_TROPOPAUSE_ALT_FT,
  ISA_SPEED_OF_SOUND_SEA_LEVEL_KNOTS,
} from './isa.js';

describe('ISA standard atmosphere model', () => {
  describe('isaTemperatureCelsius', () => {
    it('returns 15 C at sea level (0 ft)', () => {
      assert.equal(isaTemperatureCelsius(0), ISA_SEA_LEVEL_TEMP_C);
    });
    it('returns -56.5 C at and above the tropopause (36,089 ft)', () => {
      assert.ok(close(isaTemperatureCelsius(ISA_TROPOPAUSE_ALT_FT), -56.5, 0.01));
    });
    it('returns -56.5 C above the tropopause (stratosphere constant temp)', () => {
      assert.equal(isaTemperatureCelsius(40000), -56.5);
      assert.equal(isaTemperatureCelsius(65000), -56.5);
    });
    it('decreases with altitude in the troposphere', () => {
      assert.ok(isaTemperatureCelsius(10000) < isaTemperatureCelsius(5000));
    });
    it('is approximately -20.66 C at 18,000 ft (FL180)', () => {
      assert.ok(close(isaTemperatureCelsius(18000), -20.66, 0.1));
    });
    it('is approximately -54.34 C at 35,000 ft (FL350)', () => {
      assert.ok(close(isaTemperatureCelsius(35000), -54.34, 0.1));
    });
  });

  describe('pressureAtAltitudeHectopascals', () => {
    it('returns ISA sea-level pressure at 0 ft', () => {
      assert.ok(close(pressureAtAltitudeHectopascals(0), ISA_SEA_LEVEL_PRESSURE_HPA, 0.01));
    });
    it('pressure decreases with altitude', () => {
      assert.ok(pressureAtAltitudeHectopascals(10000) < pressureAtAltitudeHectopascals(5000));
    });
    it('returns ~506 hPa at 18,000 ft (roughly half sea-level pressure)', () => {
      assert.ok(close(pressureAtAltitudeHectopascals(18000), 506, 5));
    });
    it('returns ~697 hPa at 10,000 ft (FL100)', () => {
      assert.ok(close(pressureAtAltitudeHectopascals(10000), 697, 2));
    });
    it('returns a lower pressure above the tropopause', () => {
      assert.ok(
        pressureAtAltitudeHectopascals(40000) <
          pressureAtAltitudeHectopascals(ISA_TROPOPAUSE_ALT_FT),
      );
    });
  });

  describe('densityAltitudeFeet', () => {
    it('returns pressure altitude unchanged when OAT equals ISA temperature', () => {
      const pa = 5000;
      const isaTemp = isaTemperatureCelsius(pa);
      assert.ok(close(densityAltitudeFeet(pa, isaTemp), pa, 1));
    });
    it('returns higher density altitude when OAT is above ISA (hot day)', () => {
      const pa = 5000;
      const da = densityAltitudeFeet(pa, 30);
      assert.ok(da > pa, `expected DA (${da}) > PA (${pa})`);
    });
    it('returns lower density altitude when OAT is below ISA (cold day)', () => {
      const pa = 5000;
      const isaTemp = isaTemperatureCelsius(pa);
      const da = densityAltitudeFeet(pa, isaTemp - 10);
      assert.ok(da < pa, `expected DA (${da}) < PA (${pa})`);
    });
    it('computes ~7797 ft DA at PA=5000 ft and OAT=30 C', () => {
      assert.ok(close(densityAltitudeFeet(5000, 30), 7797, 20));
    });
  });

  describe('speedOfSoundKnots', () => {
    it('returns ~661.48 kt at ISA sea-level temperature (15 C)', () => {
      assert.ok(close(speedOfSoundKnots(15), ISA_SPEED_OF_SOUND_SEA_LEVEL_KNOTS, 0.1));
    });
    it('decreases as temperature decreases', () => {
      assert.ok(speedOfSoundKnots(-56.5) < speedOfSoundKnots(15));
    });
    it('returns ~573 kt at tropopause temperature (-56.5 C)', () => {
      assert.ok(close(speedOfSoundKnots(-56.5), 573, 2));
    });
  });

  describe('tasFromCasKnots', () => {
    it('returns CAS unchanged at sea level in ISA conditions', () => {
      assert.ok(close(tasFromCasKnots(200, 0, 15), 200, 1));
    });
    it('TAS is greater than CAS at altitude', () => {
      const tas = tasFromCasKnots(200, 20000);
      assert.ok(tas > 200, `expected TAS (${tas}) > CAS (200)`);
    });
    it('TAS increases with altitude for constant CAS', () => {
      const tas20k = tasFromCasKnots(200, 20000);
      const tas30k = tasFromCasKnots(200, 30000);
      assert.ok(tas30k > tas20k, `expected TAS at 30k (${tas30k}) > TAS at 20k (${tas20k})`);
    });
    it('computes reasonable TAS at FL350 ISA: CAS 250 kt -> TAS ~430 kt', () => {
      assert.ok(close(tasFromCasKnots(250, 35000), 430, 20));
    });
  });

  describe('machFromTasKnots / tasFromMachKnots', () => {
    it('Mach 1.0 at 0°C gives ~644 kt TAS', () => {
      // a = a0 * sqrt(T/T0) = 661.4788 * sqrt(273.15/288.15) ~= 644 kt
      assert.ok(close(tasFromMachKnots(1.0, 0), 644, 2));
    });
    it('470 kt TAS at ISA tropopause (-56.5°C) is ~M0.82', () => {
      // speed of sound at -56.5°C ~= 573 kt; 470/573 ~= 0.82
      assert.ok(close(machFromTasKnots(470, -56.5), 0.82, 0.005));
    });
    it('machFromTasKnots and tasFromMachKnots are inverses', () => {
      const oat = -40;
      const tas = 450;
      assert.ok(close(tasFromMachKnots(machFromTasKnots(tas, oat), oat), tas, 0.01));
    });
  });
});
