import { describe, expect, it, vi } from 'vitest';

import type { AircraftRegistration } from '@squawk/types';

import {
  createAircraftModelProvider,
  loadBundledRegistry,
  toAircraftDetails,
} from './aircraft-model.js';
import type { RegistrationSource } from './aircraft-model.js';

function makeRegistry(records: AircraftRegistration[]): RegistrationSource {
  return {
    lookup: (icaoHex) => records.find((record) => record.icaoHex === icaoHex.toUpperCase()),
  };
}

const REGISTRY = makeRegistry([
  { icaoHex: 'A4CE45', registration: 'N409CC', model: ' PA-28-181 ' },
  { icaoHex: 'A00001', registration: 'N1' },
  { icaoHex: 'A00002', registration: 'N2', model: '   ' },
]);

describe('createAircraftModelProvider', () => {
  it('finds nothing, and loads nothing, until it is told to load', () => {
    const loadRegistry = vi.fn(() => Promise.resolve(REGISTRY));

    const provider = createAircraftModelProvider({ loadRegistry });

    expect(provider.lookup('a4ce45')).toBeUndefined();
    expect(loadRegistry).not.toHaveBeenCalled();
  });

  it('looks up the registered model once loaded, trimmed, whatever the case of the hex', async () => {
    const provider = createAircraftModelProvider({ loadRegistry: () => Promise.resolve(REGISTRY) });

    await provider.load();

    expect(provider.lookup('a4ce45')).toBe('PA-28-181');
    expect(provider.lookup('A4CE45')).toBe('PA-28-181');
  });

  it('finds nothing for an aircraft that is not registered, or has no model on record', async () => {
    const provider = createAircraftModelProvider({ loadRegistry: () => Promise.resolve(REGISTRY) });
    await provider.load();

    expect(provider.lookup('c0ffee')).toBeUndefined();
    expect(provider.lookup('a00001')).toBeUndefined();
    expect(provider.lookup('a00002')).toBeUndefined();
  });

  it('rejects a failed load, and goes on finding nothing', async () => {
    const provider = createAircraftModelProvider({
      loadRegistry: () => Promise.reject(new Error('snapshot unreadable')),
    });

    await expect(provider.load()).rejects.toThrow('snapshot unreadable');
    expect(provider.lookup('a4ce45')).toBeUndefined();
  });
});

describe('aircraft details', () => {
  it('reduces a registry record to the fields the scope shows, trimmed', () => {
    expect(
      toAircraftDetails({
        icaoHex: 'A4CE45',
        registration: 'N409CC',
        make: ' PIPER AIRCRAFT INC ',
        model: 'PA-28-181',
        operator: 'PAPPY AIR LLC',
        aircraftType: 'fixedWingSingleEngine',
        engineType: 'reciprocating',
        yearManufactured: 2023,
      }),
    ).toEqual({
      icaoHex: 'A4CE45',
      registration: 'N409CC',
      make: 'PIPER AIRCRAFT INC',
      model: 'PA-28-181',
      operator: 'PAPPY AIR LLC',
      yearManufactured: 2023,
    });
  });

  it('leaves out what the registry left blank', () => {
    expect(
      toAircraftDetails({ icaoHex: 'A00001', registration: 'N1', make: '  ', operator: '' }),
    ).toEqual({ icaoHex: 'A00001', registration: 'N1' });
  });

  it('is found through the provider once the registry has loaded, and not before', async () => {
    const provider = createAircraftModelProvider({ loadRegistry: () => Promise.resolve(REGISTRY) });
    expect(provider.details('a4ce45')).toBeUndefined();

    await provider.load();

    expect(provider.details('a4ce45')).toEqual({
      icaoHex: 'A4CE45',
      registration: 'N409CC',
      model: 'PA-28-181',
    });
    expect(provider.details('c0ffee')).toBeUndefined();
  });
});

describe('loadBundledRegistry', () => {
  it('loads the bundled FAA registry, which is what the provider uses by default', async () => {
    const { usBundledRegistry } = await import('@squawk/icao-registry-data');
    const known = usBundledRegistry.records.find((record) => (record.model ?? '').trim() !== '');
    if (known === undefined) {
      throw new Error('the bundled registry has no record with a model');
    }
    const registry = await loadBundledRegistry();
    const provider = createAircraftModelProvider();
    await provider.load();

    expect(registry.lookup(known.icaoHex)).toEqual(known);
    expect(provider.lookup(known.icaoHex.toLowerCase())).toBe(known.model?.trim());
  }, 30_000);
});
