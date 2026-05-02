import { describe, it, expect, assert } from 'vitest';
import { usBundledFixes } from './index.js';

describe('usBundledFixes', () => {
  it('loads with a reasonable number of records', () => {
    assert(usBundledFixes.records.length > 50_000);
  });

  it('has metadata with generatedAt, nasrCycleDate, and recordCount', () => {
    assert(usBundledFixes.properties.generatedAt.length > 0);
    assert(usBundledFixes.properties.nasrCycleDate.length > 0);
    expect(usBundledFixes.properties.recordCount).toBe(usBundledFixes.records.length);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledFixes.records[0];
    assert(first !== undefined);
    expect(typeof first.identifier).toBe('string');
    assert(first.identifier.length > 0);
    expect(typeof first.icaoRegionCode).toBe('string');
    expect(typeof first.country).toBe('string');
    expect(typeof first.lat).toBe('number');
    expect(typeof first.lon).toBe('number');
    expect(typeof first.useCode).toBe('string');
    expect(typeof first.pitch).toBe('boolean');
    expect(typeof first.catch).toBe('boolean');
    expect(typeof first.suaAtcaa).toBe('boolean');
    assert(Array.isArray(first.chartTypes));
    assert(Array.isArray(first.navaidAssociations));
  });

  it('populates state for US fixes', () => {
    const us = usBundledFixes.records.find((r) => r.country === 'US');
    assert(us !== undefined);
    expect(typeof us.state).toBe('string');
    assert(us.state && us.state.length > 0);
  });

  it('includes foreign fixes that the FAA publishes (e.g. Canadian fixes)', () => {
    const foreign = usBundledFixes.records.filter((r) => r.country !== 'US');
    assert(foreign.length > 0, 'expected at least one foreign fix');

    const canadian = usBundledFixes.records.find((r) => r.country === 'CA');
    assert(canadian !== undefined, 'expected at least one Canadian fix');
    expect(canadian.state, 'non-US fixes should have no state').toBe(undefined);
    expect(canadian.icaoRegionCode.startsWith('CY')).toBe(true);
  });

  it('does not contain CNF (computer navigation fix) records', () => {
    const cnf = usBundledFixes.records.find((r) => r.useCode === 'CN');
    expect(cnf, 'CNF records should be excluded').toBe(undefined);
  });

  it('contains records with various use codes', () => {
    const useCodes = new Set(usBundledFixes.records.map((r) => r.useCode));
    assert(useCodes.has('WP'), 'expected WP use code');
    assert(useCodes.has('RP'), 'expected RP use code');
  });

  it('contains records with optional fields populated', () => {
    const withArtcc = usBundledFixes.records.find((r) => r.highArtccId !== undefined);
    assert(withArtcc !== undefined, 'expected at least one fix with highArtccId');

    const withCompulsory = usBundledFixes.records.find((r) => r.compulsory !== undefined);
    assert(withCompulsory !== undefined, 'expected at least one compulsory fix');

    const withCharts = usBundledFixes.records.find((r) => r.chartTypes.length > 0);
    assert(withCharts !== undefined, 'expected at least one fix with chart types');
  });

  it('contains records with navaid associations', () => {
    const withNav = usBundledFixes.records.find((r) => r.navaidAssociations.length > 0);
    assert(withNav !== undefined, 'expected at least one fix with navaid associations');
    const assoc = withNav.navaidAssociations[0]!;
    expect(typeof assoc.navaidId).toBe('string');
    expect(typeof assoc.navaidType).toBe('string');
    expect(typeof assoc.bearingDeg).toBe('number');
    expect(typeof assoc.distanceNm).toBe('number');
  });

  it('can find a known fix by scanning records', () => {
    const merit = usBundledFixes.records.find((r) => r.identifier === 'MERIT');
    assert(merit !== undefined, 'expected to find MERIT fix');
    expect(merit.country).toBe('US');
  });
});
