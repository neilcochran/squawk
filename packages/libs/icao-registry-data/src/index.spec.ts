import { describe, it, expect, assert } from 'vitest';

import { usBundledRegistry } from './index.js';

describe('usBundledRegistry', () => {
  it('loads with a reasonable number of records', () => {
    assert(usBundledRegistry.records.length > 200_000);
  });

  it('has metadata with generatedAt and recordCount', () => {
    assert(usBundledRegistry.properties.generatedAt.length > 0);
    expect(usBundledRegistry.properties.recordCount).toBe(usBundledRegistry.records.length);
  });

  it('contains records with the expected shape', () => {
    const first = usBundledRegistry.records[0];
    assert(first !== undefined);
    expect(typeof first.icaoHex).toBe('string');
    expect(typeof first.registration).toBe('string');
    assert(first.icaoHex.length > 0);
    assert(first.registration.startsWith('N'));
  });

  it('contains records with optional fields populated', () => {
    const withMake = usBundledRegistry.records.find((r) => r.make !== undefined);
    assert(withMake !== undefined);
    expect(typeof withMake.make).toBe('string');

    const withModel = usBundledRegistry.records.find((r) => r.model !== undefined);
    assert(withModel !== undefined);

    const withType = usBundledRegistry.records.find((r) => r.aircraftType !== undefined);
    assert(withType !== undefined);

    const withEngine = usBundledRegistry.records.find((r) => r.engineType !== undefined);
    assert(withEngine !== undefined);
  });

  it('can look up a known ICAO hex by scanning records', () => {
    const n100 = usBundledRegistry.records.find((r) => r.icaoHex === 'A004B3');
    assert(n100 !== undefined);
    expect(n100.registration).toBe('N100');
  });
});
