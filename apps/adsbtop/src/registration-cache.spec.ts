import { describe, expect, it, vi } from 'vitest';

import type { IcaoRegistry } from '@squawk/icao-registry';
import type { Aircraft, AircraftRegistration } from '@squawk/types';

import { enrichAircraftList } from './registration-cache.js';
import type { RegistrationCache } from './registration-cache.js';

function makeAircraft(icaoHex: string): Aircraft {
  return { icaoHex, lastSeenAt: 0 };
}

function makeRegistration(icaoHex: string): AircraftRegistration {
  return { icaoHex, registration: `N-${icaoHex}` };
}

function makeFakeRegistry(lookup: IcaoRegistry['lookup']): IcaoRegistry {
  return { lookup, recordCount: 0 };
}

describe('enrichAircraftList', () => {
  it('returns aircraft unchanged when the registry is not yet loaded', () => {
    const aircraft = [makeAircraft('A0B1C2')];
    const cache: RegistrationCache = new Map();

    const result = enrichAircraftList(aircraft, undefined, cache);

    expect(result).toEqual(aircraft);
    expect(result[0]).toBe(aircraft[0]);
  });

  it('populates registration for an aircraft the registry matches', () => {
    const aircraft = [makeAircraft('A0B1C2')];
    const registry = makeFakeRegistry((icaoHex) => makeRegistration(icaoHex));
    const cache: RegistrationCache = new Map();

    const result = enrichAircraftList(aircraft, registry, cache);

    expect(result[0]?.registration?.registration).toBe('N-A0B1C2');
  });

  it('leaves an aircraft unchanged (same object reference) when the registry has no match', () => {
    const aircraft = [makeAircraft('A0B1C2')];
    const registry = makeFakeRegistry(() => undefined);
    const cache: RegistrationCache = new Map();

    const result = enrichAircraftList(aircraft, registry, cache);

    expect(result[0]).toBe(aircraft[0]);
  });

  it('only looks up a given icaoHex once, reusing the cache on later calls', () => {
    const lookup = vi.fn((icaoHex: string) => makeRegistration(icaoHex));
    const registry = makeFakeRegistry(lookup);
    const cache: RegistrationCache = new Map();

    enrichAircraftList([makeAircraft('A0B1C2')], registry, cache);
    enrichAircraftList([makeAircraft('A0B1C2')], registry, cache);
    enrichAircraftList([makeAircraft('A0B1C2')], registry, cache);

    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('caches a miss too, so a hex with no match is not looked up again', () => {
    const lookup = vi.fn(() => undefined);
    const registry = makeFakeRegistry(lookup);
    const cache: RegistrationCache = new Map();

    enrichAircraftList([makeAircraft('A0B1C2')], registry, cache);
    enrichAircraftList([makeAircraft('A0B1C2')], registry, cache);

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(cache.has('A0B1C2')).toBe(true);
    expect(cache.get('A0B1C2')).toBeUndefined();
  });

  it('resolves each aircraft in a list independently', () => {
    const registry = makeFakeRegistry((icaoHex) =>
      icaoHex === 'A0B1C2' ? makeRegistration(icaoHex) : undefined,
    );
    const cache: RegistrationCache = new Map();

    const result = enrichAircraftList(
      [makeAircraft('A0B1C2'), makeAircraft('D3E4F5')],
      registry,
      cache,
    );

    expect(result[0]?.registration?.registration).toBe('N-A0B1C2');
    expect(result[1]?.registration).toBeUndefined();
  });
});
