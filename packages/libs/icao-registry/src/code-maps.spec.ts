import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { AIRCRAFT_TYPE_MAP, ENGINE_TYPE_MAP } from './code-maps.js';

describe('AIRCRAFT_TYPE_MAP', () => {
  it('maps all FAA aircraft type codes', () => {
    assert.equal(AIRCRAFT_TYPE_MAP['1'], 'glider');
    assert.equal(AIRCRAFT_TYPE_MAP['2'], 'balloon');
    assert.equal(AIRCRAFT_TYPE_MAP['3'], 'blimpOrDirigible');
    assert.equal(AIRCRAFT_TYPE_MAP['4'], 'fixedWingSingleEngine');
    assert.equal(AIRCRAFT_TYPE_MAP['5'], 'fixedWingMultiEngine');
    assert.equal(AIRCRAFT_TYPE_MAP['6'], 'rotorcraft');
    assert.equal(AIRCRAFT_TYPE_MAP['7'], 'weightShiftControl');
    assert.equal(AIRCRAFT_TYPE_MAP['8'], 'poweredParachute');
    assert.equal(AIRCRAFT_TYPE_MAP['9'], 'gyroplane');
    assert.equal(AIRCRAFT_TYPE_MAP['H'], 'hybridLift');
  });

  it('has exactly 10 entries', () => {
    assert.equal(Object.keys(AIRCRAFT_TYPE_MAP).length, 10);
  });

  it('returns undefined for unknown codes', () => {
    assert.equal(AIRCRAFT_TYPE_MAP['99'], undefined);
    assert.equal(AIRCRAFT_TYPE_MAP[''], undefined);
  });
});

describe('ENGINE_TYPE_MAP', () => {
  it('maps all FAA engine type codes', () => {
    assert.equal(ENGINE_TYPE_MAP['0'], 'none');
    assert.equal(ENGINE_TYPE_MAP['1'], 'reciprocating');
    assert.equal(ENGINE_TYPE_MAP['2'], 'turboProp');
    assert.equal(ENGINE_TYPE_MAP['3'], 'turboShaft');
    assert.equal(ENGINE_TYPE_MAP['4'], 'turboJet');
    assert.equal(ENGINE_TYPE_MAP['5'], 'turboFan');
    assert.equal(ENGINE_TYPE_MAP['6'], 'ramjet');
    assert.equal(ENGINE_TYPE_MAP['7'], 'twoCycle');
    assert.equal(ENGINE_TYPE_MAP['8'], 'fourCycle');
    assert.equal(ENGINE_TYPE_MAP['9'], 'unknown');
    assert.equal(ENGINE_TYPE_MAP['10'], 'electric');
    assert.equal(ENGINE_TYPE_MAP['11'], 'rotary');
  });

  it('has exactly 12 entries', () => {
    assert.equal(Object.keys(ENGINE_TYPE_MAP).length, 12);
  });

  it('returns undefined for unknown codes', () => {
    assert.equal(ENGINE_TYPE_MAP['99'], undefined);
    assert.equal(ENGINE_TYPE_MAP[''], undefined);
  });
});
