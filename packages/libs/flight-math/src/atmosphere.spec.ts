import { describe, it, assert } from 'vitest';
import { close } from './test-utils.js';
import { isa } from '@squawk/units';
import { atmosphere } from './index.js';

describe('densityAltitude', () => {
  it('returns ISA density altitude when temperature is standard', () => {
    // At sea level with standard pressure and standard temp (15C),
    // density altitude should equal field elevation (0 ft).
    const da = atmosphere.densityAltitude(0, 29.92, 15);
    assert(close(da, 0, 5), `expected ~0, got ${da}`);
  });

  it('increases with above-standard temperature', () => {
    // Denver-like scenario: 5000 ft field, standard pressure, hot day (35C).
    // ISA at 5000 ft is ~5.1C, so 35C is ~30C above standard.
    // DA should be well above 5000 ft.
    const da = atmosphere.densityAltitude(5000, 29.92, 35);
    assert(da > 7000, `expected DA > 7000, got ${da}`);
  });

  it('decreases with below-standard temperature', () => {
    // Cold day: 3000 ft field, standard pressure, -10C.
    // ISA at 3000 ft is ~9.1C, so -10C is well below standard.
    // DA should be below 3000 ft.
    const da = atmosphere.densityAltitude(3000, 29.92, -10);
    assert(da < 3000, `expected DA < 3000, got ${da}`);
  });

  it('accounts for non-standard altimeter setting', () => {
    // Low pressure (29.42 inHg) at sea level with standard temp.
    // Pressure altitude is ~500 ft above sea level, DA rises accordingly.
    const da = atmosphere.densityAltitude(0, 29.42, 15);
    assert(da > 300, `expected DA > 300, got ${da}`);
  });

  it('matches isa.densityAltitudeFt when given pressure altitude directly', () => {
    // When altimeter is 29.92, indicated = pressure altitude.
    // densityAltitude(5000, 29.92, 20) should match isa.densityAltitudeFt(5000, 20).
    const da = atmosphere.densityAltitude(5000, 29.92, 20);
    const expected = isa.densityAltitudeFt(5000, 20);
    assert(close(da, expected, 5), `expected ~${expected}, got ${da}`);
  });

  it('combines non-standard pressure and temperature effects', () => {
    // Hot day with low pressure: both factors increase density altitude.
    // 5000 ft field, 29.42 inHg (low), 35C (hot).
    const da = atmosphere.densityAltitude(5000, 29.42, 35);
    // Both low pressure (PA > field elev) and hot temp push DA up.
    // Should be higher than either factor alone.
    const daLowPressOnly = atmosphere.densityAltitude(5000, 29.42, isa.isaTemperatureCelsius(5500));
    const daHotOnly = atmosphere.densityAltitude(5000, 29.92, 35);
    assert(da > daLowPressOnly, `expected combined (${da}) > pressure-only (${daLowPressOnly})`);
    assert(da > daHotOnly, `expected combined (${da}) > temp-only (${daHotOnly})`);
  });
});

describe('trueAltitude', () => {
  it('equals indicated altitude under ISA conditions', () => {
    // At 10,000 ft indicated, standard pressure, ISA temp at 10,000 ft (~-4.8C).
    const isaTemp = -4.81;
    const ta = atmosphere.trueAltitude(10000, 29.92, isaTemp);
    assert(close(ta, 10000, 5), `expected ~10,000, got ${ta}`);
  });

  it('is higher than indicated in warmer-than-standard air', () => {
    // Warm air is less dense, pressure levels are higher.
    // 10,000 ft indicated, standard pressure, 10C (ISA is ~-4.8C).
    const ta = atmosphere.trueAltitude(10000, 29.92, 10);
    assert(ta > 10000, `expected > 10,000, got ${ta}`);
  });

  it('is lower than indicated in colder-than-standard air', () => {
    // Cold air is denser, pressure levels are lower.
    // 10,000 ft indicated, standard pressure, -20C (ISA is ~-4.8C).
    const ta = atmosphere.trueAltitude(10000, 29.92, -20);
    assert(ta < 10000, `expected < 10,000, got ${ta}`);
  });

  it('accounts for non-standard altimeter setting', () => {
    // Low pressure shifts pressure altitude up, affecting the correction.
    const taStd = atmosphere.trueAltitude(5000, 29.92, 0);
    const taLow = atmosphere.trueAltitude(5000, 29.42, 0);
    // Lower altimeter setting means higher pressure altitude, so the
    // ISA reference temperature is colder, making the OAT/ISA ratio larger.
    assert(taLow > taStd, `expected low-pressure TA (${taLow}) > standard TA (${taStd})`);
  });

  it('returns indicated altitude under ISA temp with non-standard pressure', () => {
    // When OAT matches ISA at the pressure altitude, the correction ratio is 1,
    // so true altitude should equal indicated altitude regardless of altimeter setting.
    const indicated = 8000;
    const altSetting = 29.42;
    const pa = 8000 + (29.92 - 29.42) * 1000; // ~8500 ft PA
    const isaAtPa = isa.isaTemperatureCelsius(pa);
    const ta = atmosphere.trueAltitude(indicated, altSetting, isaAtPa);
    assert(close(ta, indicated, 5), `expected ~${indicated}, got ${ta}`);
  });

  it('applies correction only above station when stationElevationFt is provided', () => {
    // 10,000 ft indicated, standard pressure, warm temp (10C vs ISA ~-4.8C).
    // Station at 5,000 ft: only the 5,000 ft above the station is corrected.
    const taFull = atmosphere.trueAltitude(10000, 29.92, 10);
    const taStation = atmosphere.trueAltitude(10000, 29.92, 10, 5000);
    // The station-based correction is smaller because it only corrects 5,000 ft
    // of air column instead of the full 10,000 ft.
    assert(taStation < taFull, `expected station-corrected (${taStation}) < full (${taFull})`);
    assert(taStation > 10000, `expected station-corrected (${taStation}) > indicated (10000)`);
  });

  it('returns indicated altitude under ISA temp when station elevation is provided', () => {
    // When OAT matches ISA, the ratio is 1 and the correction is zero
    // regardless of station elevation.
    const indicated = 8000;
    const isaTemp = isa.isaTemperatureCelsius(8000);
    const ta = atmosphere.trueAltitude(indicated, 29.92, isaTemp, 3000);
    assert(close(ta, indicated, 5), `expected ~${indicated}, got ${ta}`);
  });

  it('matches simplified method when station elevation is zero', () => {
    // With station at sea level, the full indicated altitude is the column
    // above the station, so both methods produce the same result.
    const taSimplified = atmosphere.trueAltitude(10000, 29.92, 10);
    const taWithStation = atmosphere.trueAltitude(10000, 29.92, 10, 0);
    assert(
      close(taWithStation, taSimplified, 0.01),
      `expected ${taSimplified}, got ${taWithStation}`,
    );
  });
});
