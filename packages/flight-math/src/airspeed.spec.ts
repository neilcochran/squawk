import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import { isa } from '@squawk/units';
import { airspeed } from './index.js';

describe('casFromTas', () => {
  it('returns the same value at sea level with ISA conditions', () => {
    // At sea level ISA, CAS = TAS.
    const cas = airspeed.casFromTas(150, 0);
    assert.ok(close(cas, 150, 0.1), `expected ~150, got ${cas}`);
  });

  it('returns CAS lower than TAS at altitude', () => {
    // At altitude, CAS < TAS because air is thinner.
    const cas = airspeed.casFromTas(250, 20000);
    assert.ok(cas < 250, `expected CAS < 250 at FL200, got ${cas}`);
  });

  it('round-trips with isa.tasFromCasKnots at ISA conditions', () => {
    // casFromTas(tasFromCas(CAS)) should return the original CAS.
    const originalCas = 180;
    const alt = 10000;
    const tas = isa.tasFromCasKnots(originalCas, alt);
    const roundTripped = airspeed.casFromTas(tas, alt);
    assert.ok(
      close(roundTripped, originalCas, 0.01),
      `expected ~${originalCas}, got ${roundTripped}`,
    );
  });

  it('round-trips with isa.tasFromCasKnots at non-ISA temperature', () => {
    const originalCas = 200;
    const alt = 15000;
    const oat = -5; // Warmer than ISA at FL150.
    const tas = isa.tasFromCasKnots(originalCas, alt, oat);
    const roundTripped = airspeed.casFromTas(tas, alt, oat);
    assert.ok(
      close(roundTripped, originalCas, 0.01),
      `expected ~${originalCas}, got ${roundTripped}`,
    );
  });

  it('round-trips at high altitude', () => {
    const originalCas = 250;
    const alt = 35000;
    const tas = isa.tasFromCasKnots(originalCas, alt);
    const roundTripped = airspeed.casFromTas(tas, alt);
    assert.ok(
      close(roundTripped, originalCas, 0.05),
      `expected ~${originalCas}, got ${roundTripped}`,
    );
  });

  it('round-trips at low altitude and low speed', () => {
    const originalCas = 60;
    const alt = 1000;
    const tas = isa.tasFromCasKnots(originalCas, alt);
    const roundTripped = airspeed.casFromTas(tas, alt);
    assert.ok(
      close(roundTripped, originalCas, 0.01),
      `expected ~${originalCas}, got ${roundTripped}`,
    );
  });

  it('uses ISA temperature when oatCelsius is omitted', () => {
    // With no OAT specified, should use ISA standard temp at the altitude.
    // This should match the round-trip with isa.tasFromCasKnots (which also defaults to ISA).
    const originalCas = 180;
    const alt = 10000;
    const tas = isa.tasFromCasKnots(originalCas, alt);
    const withDefault = airspeed.casFromTas(tas, alt);
    const withExplicitIsa = airspeed.casFromTas(tas, alt, isa.isaTemperatureCelsius(alt));
    assert.ok(
      close(withDefault, withExplicitIsa, 0.01),
      `expected default (${withDefault}) to match explicit ISA (${withExplicitIsa})`,
    );
  });
});
