import { describe, it, expect, assert } from 'vitest';

import { usBundledNavaids } from './index.js';

describe('usBundledNavaids', () => {
  it('loads with a reasonable number of records', () => {
    assert(usBundledNavaids.records.length > 1_000);
  });

  it('has metadata with generatedAt, nasrCycleDate, and recordCount', () => {
    assert(usBundledNavaids.properties.generatedAt.length > 0);
    assert(usBundledNavaids.properties.nasrCycleDate.length > 0);
    expect(usBundledNavaids.properties.recordCount).toBe(usBundledNavaids.records.length);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledNavaids.records[0];
    assert(first !== undefined);
    expect(typeof first.identifier).toBe('string');
    assert(first.identifier.length > 0);
    expect(typeof first.name).toBe('string');
    expect(typeof first.type).toBe('string');
    expect(typeof first.status).toBe('string');
    expect(typeof first.lat).toBe('number');
    expect(typeof first.lon).toBe('number');
    expect(typeof first.country).toBe('string');
  });

  it('populates state for US navaids', () => {
    const us = usBundledNavaids.records.find((r) => r.country === 'US');
    assert(us !== undefined);
    expect(typeof us.state).toBe('string');
    assert(us.state && us.state.length > 0);
  });

  it('includes foreign navaids that the FAA publishes (e.g. Canadian navaids)', () => {
    const foreign = usBundledNavaids.records.filter((r) => r.country !== 'US');
    assert(foreign.length > 0, 'expected at least one foreign navaid');

    const canadian = usBundledNavaids.records.find((r) => r.country === 'CA');
    assert(canadian !== undefined, 'expected at least one Canadian navaid');
    expect(canadian.state, 'non-US navaids should have no state').toBe(undefined);
  });

  it('does not contain SHUTDOWN navaids', () => {
    const shutdown = usBundledNavaids.records.find((r) => r.status === 'SHUTDOWN');
    expect(shutdown, 'SHUTDOWN navaids should be excluded').toBe(undefined);
  });

  it('contains records with various navaid types', () => {
    const types = new Set(usBundledNavaids.records.map((r) => r.type));
    assert(types.has('VOR'), 'expected VOR type');
    assert(types.has('VORTAC'), 'expected VORTAC type');
    assert(types.has('NDB'), 'expected NDB type');
  });

  it('contains records with optional fields populated', () => {
    const withFreqMhz = usBundledNavaids.records.find((r) => r.frequencyMhz !== undefined);
    assert(withFreqMhz !== undefined, 'expected at least one navaid with frequencyMhz');

    const withFreqKhz = usBundledNavaids.records.find((r) => r.frequencyKhz !== undefined);
    assert(withFreqKhz !== undefined, 'expected at least one navaid with frequencyKhz');

    const withElev = usBundledNavaids.records.find((r) => r.elevationFt !== undefined);
    assert(withElev !== undefined, 'expected at least one navaid with elevationFt');

    const withArtcc = usBundledNavaids.records.find((r) => r.lowArtccId !== undefined);
    assert(withArtcc !== undefined, 'expected at least one navaid with lowArtccId');
  });

  it('can find a known navaid by scanning records', () => {
    const bos = usBundledNavaids.records.find((r) => r.identifier === 'BOS');
    assert(bos !== undefined, 'expected to find BOS navaid');
    expect(bos.country).toBe('US');
    assert(bos.type === 'VOR' || bos.type === 'VORTAC' || bos.type === 'VOR/DME');
  });
});
