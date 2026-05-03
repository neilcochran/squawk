import { describe, it, assert } from 'vitest';

import { isa } from '@squawk/units';

import { close } from './test-utils.js';

import { airspeed } from './index.js';

describe('calibratedAirspeedFromTrueAirspeed', () => {
  it('returns the same value at sea level with ISA conditions', () => {
    // At sea level ISA, CAS = TAS.
    const cas = airspeed.calibratedAirspeedFromTrueAirspeed(150, 0);
    assert(close(cas, 150, 0.1), `expected ~150, got ${cas}`);
  });

  it('returns CAS lower than TAS at altitude', () => {
    // At altitude, CAS < TAS because air is thinner.
    const cas = airspeed.calibratedAirspeedFromTrueAirspeed(250, 20000);
    assert(cas < 250, `expected CAS < 250 at FL200, got ${cas}`);
  });

  it('round-trips with isa.trueAirspeedFromCalibratedKt at ISA conditions', () => {
    // calibratedAirspeedFromTrueAirspeed(tasFromCas(CAS)) should return the original CAS.
    const originalCas = 180;
    const alt = 10000;
    const tas = isa.trueAirspeedFromCalibratedKt(originalCas, alt);
    const roundTripped = airspeed.calibratedAirspeedFromTrueAirspeed(tas, alt);
    assert(close(roundTripped, originalCas, 0.01), `expected ~${originalCas}, got ${roundTripped}`);
  });

  it('round-trips with isa.trueAirspeedFromCalibratedKt at non-ISA temperature', () => {
    const originalCas = 200;
    const alt = 15000;
    const oat = -5; // Warmer than ISA at FL150.
    const tas = isa.trueAirspeedFromCalibratedKt(originalCas, alt, oat);
    const roundTripped = airspeed.calibratedAirspeedFromTrueAirspeed(tas, alt, oat);
    assert(close(roundTripped, originalCas, 0.01), `expected ~${originalCas}, got ${roundTripped}`);
  });

  it('round-trips at high altitude', () => {
    const originalCas = 250;
    const alt = 35000;
    const tas = isa.trueAirspeedFromCalibratedKt(originalCas, alt);
    const roundTripped = airspeed.calibratedAirspeedFromTrueAirspeed(tas, alt);
    assert(close(roundTripped, originalCas, 0.05), `expected ~${originalCas}, got ${roundTripped}`);
  });

  it('round-trips at low altitude and low speed', () => {
    const originalCas = 60;
    const alt = 1000;
    const tas = isa.trueAirspeedFromCalibratedKt(originalCas, alt);
    const roundTripped = airspeed.calibratedAirspeedFromTrueAirspeed(tas, alt);
    assert(close(roundTripped, originalCas, 0.01), `expected ~${originalCas}, got ${roundTripped}`);
  });

  it('uses ISA temperature when oatCelsius is omitted', () => {
    // With no OAT specified, should use ISA standard temp at the altitude.
    // This should match the round-trip with isa.trueAirspeedFromCalibratedKt (which also defaults to ISA).
    const originalCas = 180;
    const alt = 10000;
    const tas = isa.trueAirspeedFromCalibratedKt(originalCas, alt);
    const withDefault = airspeed.calibratedAirspeedFromTrueAirspeed(tas, alt);
    const withExplicitIsa = airspeed.calibratedAirspeedFromTrueAirspeed(
      tas,
      alt,
      isa.isaTemperatureCelsius(alt),
    );
    assert(
      close(withDefault, withExplicitIsa, 0.01),
      `expected default (${withDefault}) to match explicit ISA (${withExplicitIsa})`,
    );
  });
});
