import { describe, it, expect, assert } from 'vitest';

import {
  isaTemperatureCelsius,
  pressureAtAltitudeHectopascals,
  densityAltitudeFt,
  speedOfSoundKt,
  trueAirspeedFromCalibratedKt,
  machFromTrueAirspeedKt,
  trueAirspeedFromMachKt,
  ISA_SEA_LEVEL_TEMP_C,
  ISA_SEA_LEVEL_PRESSURE_HPA,
  ISA_TROPOPAUSE_ALTITUDE_FT,
  ISA_SPEED_OF_SOUND_SEA_LEVEL_KT,
} from './isa.js';
import { close } from './test-utils.js';

describe('ISA standard atmosphere model', () => {
  describe('isaTemperatureCelsius', () => {
    it('returns 15 C at sea level (0 ft)', () => {
      expect(isaTemperatureCelsius(0)).toBe(ISA_SEA_LEVEL_TEMP_C);
    });
    it('returns -56.5 C at and above the tropopause (36,089 ft)', () => {
      assert(close(isaTemperatureCelsius(ISA_TROPOPAUSE_ALTITUDE_FT), -56.5, 0.01));
    });
    it('returns -56.5 C above the tropopause (stratosphere constant temp)', () => {
      expect(isaTemperatureCelsius(40000)).toBe(-56.5);
      expect(isaTemperatureCelsius(65000)).toBe(-56.5);
    });
    it('decreases with altitude in the troposphere', () => {
      assert(isaTemperatureCelsius(10000) < isaTemperatureCelsius(5000));
    });
    it('is approximately -20.66 C at 18,000 ft (FL180)', () => {
      assert(close(isaTemperatureCelsius(18000), -20.66, 0.1));
    });
    it('is approximately -54.34 C at 35,000 ft (FL350)', () => {
      assert(close(isaTemperatureCelsius(35000), -54.34, 0.1));
    });
  });

  describe('pressureAtAltitudeHectopascals', () => {
    it('returns ISA sea-level pressure at 0 ft', () => {
      assert(close(pressureAtAltitudeHectopascals(0), ISA_SEA_LEVEL_PRESSURE_HPA, 0.01));
    });
    it('pressure decreases with altitude', () => {
      assert(pressureAtAltitudeHectopascals(10000) < pressureAtAltitudeHectopascals(5000));
    });
    it('returns ~506 hPa at 18,000 ft (roughly half sea-level pressure)', () => {
      assert(close(pressureAtAltitudeHectopascals(18000), 506, 5));
    });
    it('returns ~697 hPa at 10,000 ft (FL100)', () => {
      assert(close(pressureAtAltitudeHectopascals(10000), 697, 2));
    });
    it('returns a lower pressure above the tropopause', () => {
      assert(
        pressureAtAltitudeHectopascals(40000) <
          pressureAtAltitudeHectopascals(ISA_TROPOPAUSE_ALTITUDE_FT),
      );
    });
  });

  describe('densityAltitudeFt', () => {
    it('returns pressure altitude unchanged when OAT equals ISA temperature', () => {
      const pa = 5000;
      const isaTemp = isaTemperatureCelsius(pa);
      assert(close(densityAltitudeFt(pa, isaTemp), pa, 1));
    });
    it('returns higher density altitude when OAT is above ISA (hot day)', () => {
      const pa = 5000;
      const da = densityAltitudeFt(pa, 30);
      assert(da > pa, `expected DA (${da}) > PA (${pa})`);
    });
    it('returns lower density altitude when OAT is below ISA (cold day)', () => {
      const pa = 5000;
      const isaTemp = isaTemperatureCelsius(pa);
      const da = densityAltitudeFt(pa, isaTemp - 10);
      assert(da < pa, `expected DA (${da}) < PA (${pa})`);
    });
    it('computes ~7797 ft DA at PA=5000 ft and OAT=30 C', () => {
      assert(close(densityAltitudeFt(5000, 30), 7797, 20));
    });
  });

  describe('speedOfSoundKt', () => {
    it('returns ~661.48 kt at ISA sea-level temperature (15 C)', () => {
      assert(close(speedOfSoundKt(15), ISA_SPEED_OF_SOUND_SEA_LEVEL_KT, 0.1));
    });
    it('decreases as temperature decreases', () => {
      assert(speedOfSoundKt(-56.5) < speedOfSoundKt(15));
    });
    it('returns ~573 kt at tropopause temperature (-56.5 C)', () => {
      assert(close(speedOfSoundKt(-56.5), 573, 2));
    });
  });

  describe('trueAirspeedFromCalibratedKt', () => {
    it('returns CAS unchanged at sea level in ISA conditions', () => {
      assert(close(trueAirspeedFromCalibratedKt(200, 0, 15), 200, 1));
    });
    it('TAS is greater than CAS at altitude', () => {
      const tas = trueAirspeedFromCalibratedKt(200, 20000);
      assert(tas > 200, `expected TAS (${tas}) > CAS (200)`);
    });
    it('TAS increases with altitude for constant CAS', () => {
      const tas20k = trueAirspeedFromCalibratedKt(200, 20000);
      const tas30k = trueAirspeedFromCalibratedKt(200, 30000);
      assert(tas30k > tas20k, `expected TAS at 30k (${tas30k}) > TAS at 20k (${tas20k})`);
    });
    it('computes reasonable TAS at FL350 ISA: CAS 250 kt -> TAS ~430 kt', () => {
      assert(close(trueAirspeedFromCalibratedKt(250, 35000), 430, 20));
    });
  });

  describe('machFromTrueAirspeedKt / trueAirspeedFromMachKt', () => {
    it('Mach 1.0 at 0°C gives ~644 kt TAS', () => {
      // a = a0 * sqrt(T/T0) = 661.4788 * sqrt(273.15/288.15) ~= 644 kt
      assert(close(trueAirspeedFromMachKt(1.0, 0), 644, 2));
    });
    it('470 kt TAS at ISA tropopause (-56.5°C) is ~M0.82', () => {
      // speed of sound at -56.5°C ~= 573 kt; 470/573 ~= 0.82
      assert(close(machFromTrueAirspeedKt(470, -56.5), 0.82, 0.005));
    });
    it('machFromTrueAirspeedKt and trueAirspeedFromMachKt are inverses', () => {
      const oat = -40;
      const tas = 450;
      assert(close(trueAirspeedFromMachKt(machFromTrueAirspeedKt(tas, oat), oat), tas, 0.01));
    });
  });

  describe('tropopause boundary conditions', () => {
    it('temperature is exactly -56.5 C at tropopause altitude', () => {
      assert(close(isaTemperatureCelsius(ISA_TROPOPAUSE_ALTITUDE_FT), -56.5, 0.01));
    });
    it('temperature just below tropopause (FL360) increases as altitude decreases', () => {
      const tempBelow = isaTemperatureCelsius(35000);
      const tempAt = isaTemperatureCelsius(ISA_TROPOPAUSE_ALTITUDE_FT);
      // Temperature at 35000 ft should be warmer (higher) than at tropopause
      assert(tempBelow > tempAt, `expected temp at 35k (${tempBelow}) > temp at tropo (${tempAt})`);
    });
    it('pressure at tropopause is intermediate between surface and higher altitude', () => {
      const pSurface = pressureAtAltitudeHectopascals(0);
      const pTropo = pressureAtAltitudeHectopascals(ISA_TROPOPAUSE_ALTITUDE_FT);
      const pAbove = pressureAtAltitudeHectopascals(40000);
      assert(pSurface > pTropo && pTropo > pAbove);
    });
  });

  describe('stratosphere behavior with custom sea-level pressure', () => {
    it('stratosphere pressure decreases exponentially above tropopause', () => {
      const p36k = pressureAtAltitudeHectopascals(36089.24);
      const p40k = pressureAtAltitudeHectopascals(40000);
      const p50k = pressureAtAltitudeHectopascals(50000);
      assert(p36k > p40k && p40k > p50k);
    });
    it('high sea-level pressure scales stratosphere pressure upward', () => {
      // Double the sea-level pressure, stratosphere should scale similarly
      const pNormal = pressureAtAltitudeHectopascals(40000, 1013.25);
      const pHigh = pressureAtAltitudeHectopascals(40000, 1050);
      assert(pHigh > pNormal);
    });
    it('low sea-level pressure scales stratosphere pressure downward', () => {
      const pNormal = pressureAtAltitudeHectopascals(40000, 1013.25);
      const pLow = pressureAtAltitudeHectopascals(40000, 950);
      assert(pLow < pNormal);
    });
  });

  describe('reference values (immutable anchors)', () => {
    it('ISA sea level: 15°C, 1013.25 hPa, speed of sound ~661 kt', () => {
      expect(isaTemperatureCelsius(0)).toBe(15);
      assert(close(speedOfSoundKt(15), ISA_SPEED_OF_SOUND_SEA_LEVEL_KT, 0.1));
    });
    it('ISA tropopause: -56.5°C at 36089.24 ft', () => {
      assert(close(isaTemperatureCelsius(ISA_TROPOPAUSE_ALTITUDE_FT), -56.5, 0.01));
    });
    it('Standard flight level temperatures', () => {
      // FL180
      assert(close(isaTemperatureCelsius(18000), -20.66, 0.1));
      // FL350
      assert(close(isaTemperatureCelsius(35000), -54.34, 0.1));
    });
  });

  describe('real-world flight operations', () => {
    it('typical cruise FL350: temp -54.34°C, pressure ~238 hPa', () => {
      assert(close(isaTemperatureCelsius(35000), -54.34, 0.1));
      assert(close(pressureAtAltitudeHectopascals(35000), 238.4, 5));
    });
    it('typical cruise climbed from FL250 to FL350', () => {
      const temp250 = isaTemperatureCelsius(25000);
      const temp350 = isaTemperatureCelsius(35000);
      const p250 = pressureAtAltitudeHectopascals(25000);
      const p350 = pressureAtAltitudeHectopascals(35000);
      // Temperature decreases with altitude, pressure always decreases
      assert(temp250 > temp350);
      assert(p250 > p350);
    });
    it('climb segment: FL100 approach to FL180 cruise', () => {
      const temp100 = isaTemperatureCelsius(10000);
      const temp180 = isaTemperatureCelsius(18000);
      assert(close(temp100, -4.81, 0.1));
      assert(close(temp180, -20.66, 0.1));
    });
    it('descent planning: FL350 to FL100 (temperature increases, pressure decreases)', () => {
      const tempDown = isaTemperatureCelsius(10000);
      const tempUp = isaTemperatureCelsius(35000);
      const pDown = pressureAtAltitudeHectopascals(10000);
      const pUp = pressureAtAltitudeHectopascals(35000);
      assert(tempDown > tempUp); // Warmer at lower altitude
      assert(pDown > pUp); // Higher pressure at lower altitude
    });
  });

  describe('real-world TAS calculations', () => {
    it('typical cruise flight: CAS 250 kt at FL350 ISA → TAS ~430 kt', () => {
      const tas = trueAirspeedFromCalibratedKt(250, 35000);
      assert(close(tas, 430, 20));
    });
    it('approach: CAS 120 kt at 2000 ft sea-level ISA → TAS ~123 kt', () => {
      const tas = trueAirspeedFromCalibratedKt(120, 2000);
      assert(close(tas, 123.5, 2));
    });
    it('climb: CAS 140 kt at FL100 ISA conditions', () => {
      const tas = trueAirspeedFromCalibratedKt(140, 10000);
      assert(tas > 140); // TAS always > CAS at altitude
      assert(close(tas, 162.5, 5));
    });
    it('slow cruise: CAS 200 kt at FL250 warm day scenario', () => {
      // Warmer than ISA increases TAS
      const tasIsa = trueAirspeedFromCalibratedKt(200, 25000);
      const tasWarm = trueAirspeedFromCalibratedKt(200, 25000, -25); // 10°C warmer than ISA
      assert(tasWarm > tasIsa);
    });
  });

  describe('critical physics constraint: TAS >= CAS', () => {
    it('TAS is always >= CAS at sea level ISA', () => {
      const cas = 200;
      const tas = trueAirspeedFromCalibratedKt(cas, 0, 15);
      assert(
        tas >= cas - 0.01,
        `TAS (${tas}) should be >= CAS (${cas}) at sea level (within precision)`,
      );
    });
    it('TAS is always >= CAS at high altitude (FL350)', () => {
      const cas = 250;
      const tas = trueAirspeedFromCalibratedKt(cas, 35000);
      assert(tas >= cas, `TAS (${tas}) should be >= CAS (${cas}) at FL350`);
    });
    it('TAS >= CAS holds across altitude range (5k, 10k, 15k, 25k, 35k)', () => {
      const cas = 150;
      const altitudes = [5000, 10000, 15000, 25000, 35000];
      for (const alt of altitudes) {
        const tas = trueAirspeedFromCalibratedKt(cas, alt);
        assert(tas >= cas - 0.01, `TAS (${tas}) should be >= CAS (${cas}) at ${alt} ft`);
      }
    });
    it('TAS >= CAS holds for varying CAS at fixed altitude (FL250)', () => {
      const speeds = [80, 120, 150, 200, 250];
      const alt = 25000;
      for (const cas of speeds) {
        const tas = trueAirspeedFromCalibratedKt(cas, alt);
        assert(tas >= cas - 0.01, `TAS (${tas}) should be >= CAS (${cas}) at FL250`);
      }
    });
  });

  describe('critical physics constraint: Density Altitude >= Pressure Altitude', () => {
    it('DA equals PA when OAT equals ISA temperature', () => {
      const pa = 5000;
      const isaTemp = isaTemperatureCelsius(pa);
      const da = densityAltitudeFt(pa, isaTemp);
      assert(close(da, pa, 1), `DA ${da} should equal PA ${pa} when OAT equals ISA`);
    });
    it('DA > PA when OAT is above ISA (hot day)', () => {
      const pa = 5000;
      const isaTemp = isaTemperatureCelsius(pa);
      const oat = isaTemp + 10; // 10°C warmer than ISA
      const da = densityAltitudeFt(pa, oat);
      assert(da > pa, `DA (${da}) should be > PA (${pa}) on hot day`);
    });
    it('DA < PA when OAT is below ISA (cold day)', () => {
      const pa = 5000;
      const isaTemp = isaTemperatureCelsius(pa);
      const oat = isaTemp - 10; // 10°C colder than ISA
      const da = densityAltitudeFt(pa, oat);
      assert(da < pa, `DA (${da}) should be < PA (${pa}) on cold day`);
    });
    it('DA >= PA constraint holds across range of pressure altitudes', () => {
      const pressureAltitudes = [0, 2000, 5000, 10000, 15000, 25000];
      for (const pa of pressureAltitudes) {
        const isaTemp = isaTemperatureCelsius(pa);
        const da = densityAltitudeFt(pa, isaTemp);
        assert(da >= pa || close(da, pa, 1), `DA (${da}) should be >= PA (${pa})`);
      }
    });
  });
});
