import { describe, it, expect } from 'vitest';
import { AIRCRAFT_TYPE_MAP, ENGINE_TYPE_MAP } from './code-maps.js';

describe('AIRCRAFT_TYPE_MAP', () => {
  it('maps all FAA aircraft type codes', () => {
    expect(AIRCRAFT_TYPE_MAP['1']).toBe('glider');
    expect(AIRCRAFT_TYPE_MAP['2']).toBe('balloon');
    expect(AIRCRAFT_TYPE_MAP['3']).toBe('blimpOrDirigible');
    expect(AIRCRAFT_TYPE_MAP['4']).toBe('fixedWingSingleEngine');
    expect(AIRCRAFT_TYPE_MAP['5']).toBe('fixedWingMultiEngine');
    expect(AIRCRAFT_TYPE_MAP['6']).toBe('rotorcraft');
    expect(AIRCRAFT_TYPE_MAP['7']).toBe('weightShiftControl');
    expect(AIRCRAFT_TYPE_MAP['8']).toBe('poweredParachute');
    expect(AIRCRAFT_TYPE_MAP['9']).toBe('gyroplane');
    expect(AIRCRAFT_TYPE_MAP['H']).toBe('hybridLift');
  });

  it('has exactly 10 entries', () => {
    expect(Object.keys(AIRCRAFT_TYPE_MAP).length).toBe(10);
  });

  it('returns undefined for unknown codes', () => {
    expect(AIRCRAFT_TYPE_MAP['99']).toBe(undefined);
    expect(AIRCRAFT_TYPE_MAP['']).toBe(undefined);
  });
});

describe('ENGINE_TYPE_MAP', () => {
  it('maps all FAA engine type codes', () => {
    expect(ENGINE_TYPE_MAP['0']).toBe('none');
    expect(ENGINE_TYPE_MAP['1']).toBe('reciprocating');
    expect(ENGINE_TYPE_MAP['2']).toBe('turboProp');
    expect(ENGINE_TYPE_MAP['3']).toBe('turboShaft');
    expect(ENGINE_TYPE_MAP['4']).toBe('turboJet');
    expect(ENGINE_TYPE_MAP['5']).toBe('turboFan');
    expect(ENGINE_TYPE_MAP['6']).toBe('ramjet');
    expect(ENGINE_TYPE_MAP['7']).toBe('twoCycle');
    expect(ENGINE_TYPE_MAP['8']).toBe('fourCycle');
    expect(ENGINE_TYPE_MAP['9']).toBe('unknown');
    expect(ENGINE_TYPE_MAP['10']).toBe('electric');
    expect(ENGINE_TYPE_MAP['11']).toBe('rotary');
  });

  it('has exactly 12 entries', () => {
    expect(Object.keys(ENGINE_TYPE_MAP).length).toBe(12);
  });

  it('returns undefined for unknown codes', () => {
    expect(ENGINE_TYPE_MAP['99']).toBe(undefined);
    expect(ENGINE_TYPE_MAP['']).toBe(undefined);
  });
});
