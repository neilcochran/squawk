import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import type { AircraftRegistration } from '@squawk/types';
import { createIcaoRegistry } from './registry.js';

const sampleRecords: AircraftRegistration[] = [
  {
    icaoHex: 'A00001',
    registration: 'N1',
    make: 'CESSNA',
    model: '172S',
    operator: 'ACME AVIATION',
    aircraftType: 'fixedWingSingleEngine',
    engineType: 'reciprocating',
    yearManufactured: 2005,
  },
  {
    icaoHex: 'A00002',
    registration: 'N2',
    make: 'BOEING',
    model: '737-800',
    aircraftType: 'fixedWingMultiEngine',
    engineType: 'turboFan',
  },
];

describe('createIcaoRegistry', () => {
  it('looks up a record by ICAO hex', () => {
    const registry = createIcaoRegistry({ data: sampleRecords });

    const result = registry.lookup('A00001');
    assert.equal(result?.registration, 'N1');
    assert.equal(result?.make, 'CESSNA');
    assert.equal(result?.model, '172S');
  });

  it('returns undefined for unknown ICAO hex', () => {
    const registry = createIcaoRegistry({ data: sampleRecords });
    assert.equal(registry.lookup('FFFFFF'), undefined);
  });

  it('normalizes ICAO hex to uppercase', () => {
    const registry = createIcaoRegistry({ data: sampleRecords });
    const result = registry.lookup('a00001');
    assert.equal(result?.registration, 'N1');
  });

  it('reports correct record count', () => {
    const registry = createIcaoRegistry({ data: sampleRecords });
    assert.equal(registry.recordCount, 2);
  });

  it('handles empty dataset', () => {
    const registry = createIcaoRegistry({ data: [] });
    assert.equal(registry.recordCount, 0);
    assert.equal(registry.lookup('A00001'), undefined);
  });

  it('uses last record when duplicate ICAO hex values exist', () => {
    const duplicates: AircraftRegistration[] = [
      {
        icaoHex: 'A00001',
        registration: 'N1-OLD',
      },
      {
        icaoHex: 'A00001',
        registration: 'N1-NEW',
      },
    ];

    const registry = createIcaoRegistry({ data: duplicates });
    assert.equal(registry.lookup('A00001')?.registration, 'N1-NEW');
    assert.equal(registry.recordCount, 1);
  });
});
