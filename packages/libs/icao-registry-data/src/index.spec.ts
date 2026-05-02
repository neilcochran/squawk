import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { usBundledRegistry } from './index.js';

describe('usBundledRegistry', () => {
  it('loads with a reasonable number of records', () => {
    assert.ok(usBundledRegistry.records.length > 200_000);
  });

  it('has metadata with generatedAt and recordCount', () => {
    assert.ok(usBundledRegistry.properties.generatedAt.length > 0);
    assert.equal(usBundledRegistry.properties.recordCount, usBundledRegistry.records.length);
  });

  it('contains records with the expected shape', () => {
    const first = usBundledRegistry.records[0];
    assert.ok(first !== undefined);
    assert.equal(typeof first.icaoHex, 'string');
    assert.equal(typeof first.registration, 'string');
    assert.ok(first.icaoHex.length > 0);
    assert.ok(first.registration.startsWith('N'));
  });

  it('contains records with optional fields populated', () => {
    const withMake = usBundledRegistry.records.find((r) => r.make !== undefined);
    assert.ok(withMake !== undefined);
    assert.equal(typeof withMake.make, 'string');

    const withModel = usBundledRegistry.records.find((r) => r.model !== undefined);
    assert.ok(withModel !== undefined);

    const withType = usBundledRegistry.records.find((r) => r.aircraftType !== undefined);
    assert.ok(withType !== undefined);

    const withEngine = usBundledRegistry.records.find((r) => r.engineType !== undefined);
    assert.ok(withEngine !== undefined);
  });

  it('can look up a known ICAO hex by scanning records', () => {
    const n100 = usBundledRegistry.records.find((r) => r.icaoHex === 'A004B3');
    assert.ok(n100 !== undefined);
    assert.equal(n100.registration, 'N100');
  });
});
