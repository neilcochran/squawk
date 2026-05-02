import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { usBundledFixes } from './index.js';

describe('usBundledFixes', () => {
  it('loads with a reasonable number of records', () => {
    assert.ok(usBundledFixes.records.length > 50_000);
  });

  it('has metadata with generatedAt, nasrCycleDate, and recordCount', () => {
    assert.ok(usBundledFixes.properties.generatedAt.length > 0);
    assert.ok(usBundledFixes.properties.nasrCycleDate.length > 0);
    assert.equal(usBundledFixes.properties.recordCount, usBundledFixes.records.length);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledFixes.records[0];
    assert.ok(first !== undefined);
    assert.equal(typeof first.identifier, 'string');
    assert.ok(first.identifier.length > 0);
    assert.equal(typeof first.icaoRegionCode, 'string');
    assert.equal(typeof first.country, 'string');
    assert.equal(typeof first.lat, 'number');
    assert.equal(typeof first.lon, 'number');
    assert.equal(typeof first.useCode, 'string');
    assert.equal(typeof first.pitch, 'boolean');
    assert.equal(typeof first.catch, 'boolean');
    assert.equal(typeof first.suaAtcaa, 'boolean');
    assert.ok(Array.isArray(first.chartTypes));
    assert.ok(Array.isArray(first.navaidAssociations));
  });

  it('populates state for US fixes', () => {
    const us = usBundledFixes.records.find((r) => r.country === 'US');
    assert.ok(us !== undefined);
    assert.equal(typeof us.state, 'string');
    assert.ok(us.state && us.state.length > 0);
  });

  it('includes foreign fixes that the FAA publishes (e.g. Canadian fixes)', () => {
    const foreign = usBundledFixes.records.filter((r) => r.country !== 'US');
    assert.ok(foreign.length > 0, 'expected at least one foreign fix');

    const canadian = usBundledFixes.records.find((r) => r.country === 'CA');
    assert.ok(canadian !== undefined, 'expected at least one Canadian fix');
    assert.equal(canadian.state, undefined, 'non-US fixes should have no state');
    assert.equal(canadian.icaoRegionCode.startsWith('CY'), true);
  });

  it('does not contain CNF (computer navigation fix) records', () => {
    const cnf = usBundledFixes.records.find((r) => r.useCode === 'CN');
    assert.equal(cnf, undefined, 'CNF records should be excluded');
  });

  it('contains records with various use codes', () => {
    const useCodes = new Set(usBundledFixes.records.map((r) => r.useCode));
    assert.ok(useCodes.has('WP'), 'expected WP use code');
    assert.ok(useCodes.has('RP'), 'expected RP use code');
  });

  it('contains records with optional fields populated', () => {
    const withArtcc = usBundledFixes.records.find((r) => r.highArtccId !== undefined);
    assert.ok(withArtcc !== undefined, 'expected at least one fix with highArtccId');

    const withCompulsory = usBundledFixes.records.find((r) => r.compulsory !== undefined);
    assert.ok(withCompulsory !== undefined, 'expected at least one compulsory fix');

    const withCharts = usBundledFixes.records.find((r) => r.chartTypes.length > 0);
    assert.ok(withCharts !== undefined, 'expected at least one fix with chart types');
  });

  it('contains records with navaid associations', () => {
    const withNav = usBundledFixes.records.find((r) => r.navaidAssociations.length > 0);
    assert.ok(withNav !== undefined, 'expected at least one fix with navaid associations');
    const assoc = withNav.navaidAssociations[0]!;
    assert.equal(typeof assoc.navaidId, 'string');
    assert.equal(typeof assoc.navaidType, 'string');
    assert.equal(typeof assoc.bearingDeg, 'number');
    assert.equal(typeof assoc.distanceNm, 'number');
  });

  it('can find a known fix by scanning records', () => {
    const merit = usBundledFixes.records.find((r) => r.identifier === 'MERIT');
    assert.ok(merit !== undefined, 'expected to find MERIT fix');
    assert.equal(merit.country, 'US');
  });
});
