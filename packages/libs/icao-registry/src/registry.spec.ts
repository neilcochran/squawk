import { describe, it, expect } from 'vitest';

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
    expect(result?.registration).toBe('N1');
    expect(result?.make).toBe('CESSNA');
    expect(result?.model).toBe('172S');
  });

  it('returns undefined for unknown ICAO hex', () => {
    const registry = createIcaoRegistry({ data: sampleRecords });
    expect(registry.lookup('FFFFFF')).toBe(undefined);
  });

  it('normalizes ICAO hex to uppercase', () => {
    const registry = createIcaoRegistry({ data: sampleRecords });
    const result = registry.lookup('a00001');
    expect(result?.registration).toBe('N1');
  });

  it('reports correct record count', () => {
    const registry = createIcaoRegistry({ data: sampleRecords });
    expect(registry.recordCount).toBe(2);
  });

  it('handles empty dataset', () => {
    const registry = createIcaoRegistry({ data: [] });
    expect(registry.recordCount).toBe(0);
    expect(registry.lookup('A00001')).toBe(undefined);
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
    expect(registry.lookup('A00001')?.registration).toBe('N1-NEW');
    expect(registry.recordCount).toBe(1);
  });
});
