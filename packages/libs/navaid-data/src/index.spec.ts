import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { usBundledNavaids } from './index.js';

describe('usBundledNavaids', () => {
  it('loads with a reasonable number of records', () => {
    assert.ok(usBundledNavaids.records.length > 1_000);
  });

  it('has metadata with generatedAt, nasrCycleDate, and recordCount', () => {
    assert.ok(usBundledNavaids.properties.generatedAt.length > 0);
    assert.ok(usBundledNavaids.properties.nasrCycleDate.length > 0);
    assert.equal(usBundledNavaids.properties.recordCount, usBundledNavaids.records.length);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledNavaids.records[0];
    assert.ok(first !== undefined);
    assert.equal(typeof first.identifier, 'string');
    assert.ok(first.identifier.length > 0);
    assert.equal(typeof first.name, 'string');
    assert.equal(typeof first.type, 'string');
    assert.equal(typeof first.status, 'string');
    assert.equal(typeof first.lat, 'number');
    assert.equal(typeof first.lon, 'number');
    assert.equal(typeof first.country, 'string');
  });

  it('populates state for US navaids', () => {
    const us = usBundledNavaids.records.find((r) => r.country === 'US');
    assert.ok(us !== undefined);
    assert.equal(typeof us.state, 'string');
    assert.ok(us.state && us.state.length > 0);
  });

  it('includes foreign navaids that the FAA publishes (e.g. Canadian navaids)', () => {
    const foreign = usBundledNavaids.records.filter((r) => r.country !== 'US');
    assert.ok(foreign.length > 0, 'expected at least one foreign navaid');

    const canadian = usBundledNavaids.records.find((r) => r.country === 'CA');
    assert.ok(canadian !== undefined, 'expected at least one Canadian navaid');
    assert.equal(canadian.state, undefined, 'non-US navaids should have no state');
  });

  it('does not contain SHUTDOWN navaids', () => {
    const shutdown = usBundledNavaids.records.find((r) => r.status === 'SHUTDOWN');
    assert.equal(shutdown, undefined, 'SHUTDOWN navaids should be excluded');
  });

  it('contains records with various navaid types', () => {
    const types = new Set(usBundledNavaids.records.map((r) => r.type));
    assert.ok(types.has('VOR'), 'expected VOR type');
    assert.ok(types.has('VORTAC'), 'expected VORTAC type');
    assert.ok(types.has('NDB'), 'expected NDB type');
  });

  it('contains records with optional fields populated', () => {
    const withFreqMhz = usBundledNavaids.records.find((r) => r.frequencyMhz !== undefined);
    assert.ok(withFreqMhz !== undefined, 'expected at least one navaid with frequencyMhz');

    const withFreqKhz = usBundledNavaids.records.find((r) => r.frequencyKhz !== undefined);
    assert.ok(withFreqKhz !== undefined, 'expected at least one navaid with frequencyKhz');

    const withElev = usBundledNavaids.records.find((r) => r.elevationFt !== undefined);
    assert.ok(withElev !== undefined, 'expected at least one navaid with elevationFt');

    const withArtcc = usBundledNavaids.records.find((r) => r.lowArtccId !== undefined);
    assert.ok(withArtcc !== undefined, 'expected at least one navaid with lowArtccId');
  });

  it('can find a known navaid by scanning records', () => {
    const bos = usBundledNavaids.records.find((r) => r.identifier === 'BOS');
    assert.ok(bos !== undefined, 'expected to find BOS navaid');
    assert.equal(bos.country, 'US');
    assert.ok(bos.type === 'VOR' || bos.type === 'VORTAC' || bos.type === 'VOR/DME');
  });
});
