import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import { isa } from '@squawk/units';
import { atmosphere } from './index.js';

describe('densityAltitude', () => {
  it('returns ISA density altitude when temperature is standard', () => {
    // At sea level with standard pressure and standard temp (15C),
    // density altitude should equal field elevation (0 ft).
    const da = atmosphere.densityAltitude(0, 29.92, 15);
    assert.ok(close(da, 0, 5), `expected ~0, got ${da}`);
  });

  it('increases with above-standard temperature', () => {
    // Denver-like scenario: 5000 ft field, standard pressure, hot day (35C).
    // ISA at 5000 ft is ~5.1C, so 35C is ~30C above standard.
    // DA should be well above 5000 ft.
    const da = atmosphere.densityAltitude(5000, 29.92, 35);
    assert.ok(da > 7000, `expected DA > 7000, got ${da}`);
  });

  it('decreases with below-standard temperature', () => {
    // Cold day: 3000 ft field, standard pressure, -10C.
    // ISA at 3000 ft is ~9.1C, so -10C is well below standard.
    // DA should be below 3000 ft.
    const da = atmosphere.densityAltitude(3000, 29.92, -10);
    assert.ok(da < 3000, `expected DA < 3000, got ${da}`);
  });

  it('accounts for non-standard altimeter setting', () => {
    // Low pressure (29.42 inHg) at sea level with standard temp.
    // Pressure altitude is ~500 ft above sea level, DA rises accordingly.
    const da = atmosphere.densityAltitude(0, 29.42, 15);
    assert.ok(da > 300, `expected DA > 300, got ${da}`);
  });

  it('matches isa.densityAltitudeFeet when given pressure altitude directly', () => {
    // When altimeter is 29.92, indicated = pressure altitude.
    // densityAltitude(5000, 29.92, 20) should match isa.densityAltitudeFeet(5000, 20).
    const da = atmosphere.densityAltitude(5000, 29.92, 20);
    const expected = isa.densityAltitudeFeet(5000, 20);
    assert.ok(close(da, expected, 5), `expected ~${expected}, got ${da}`);
  });
});

describe('trueAltitude', () => {
  it('equals indicated altitude under ISA conditions', () => {
    // At 10,000 ft indicated, standard pressure, ISA temp at 10,000 ft (~-4.8C).
    const isaTemp = -4.81;
    const ta = atmosphere.trueAltitude(10000, 29.92, isaTemp);
    assert.ok(close(ta, 10000, 5), `expected ~10,000, got ${ta}`);
  });

  it('is higher than indicated in warmer-than-standard air', () => {
    // Warm air is less dense, pressure levels are higher.
    // 10,000 ft indicated, standard pressure, 10C (ISA is ~-4.8C).
    const ta = atmosphere.trueAltitude(10000, 29.92, 10);
    assert.ok(ta > 10000, `expected > 10,000, got ${ta}`);
  });

  it('is lower than indicated in colder-than-standard air', () => {
    // Cold air is denser, pressure levels are lower.
    // 10,000 ft indicated, standard pressure, -20C (ISA is ~-4.8C).
    const ta = atmosphere.trueAltitude(10000, 29.92, -20);
    assert.ok(ta < 10000, `expected < 10,000, got ${ta}`);
  });

  it('accounts for non-standard altimeter setting', () => {
    // Low pressure shifts pressure altitude up, affecting the correction.
    const taStd = atmosphere.trueAltitude(5000, 29.92, 0);
    const taLow = atmosphere.trueAltitude(5000, 29.42, 0);
    // Lower altimeter setting means higher pressure altitude, so the
    // true altitude should be higher for the same indicated altitude.
    assert.ok(taLow > taStd, `expected low-pressure TA (${taLow}) > standard TA (${taStd})`);
  });
});
