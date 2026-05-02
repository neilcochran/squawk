import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert/strict';
import type { Fix, FixUseCode } from '@squawk/types';
import { createFixResolver } from './resolver.js';
import type { FixResolver } from './resolver.js';

/**
 * Loads the real fix-data dataset by importing the compiled package.
 * Tests in this file run against real FAA data to verify correctness.
 */
async function loadRealData(): Promise<Fix[]> {
  const { usBundledFixes } = await import('@squawk/fix-data');
  return usBundledFixes.records;
}

let resolver: FixResolver;

beforeAll(async () => {
  const data = await loadRealData();
  resolver = createFixResolver({ data });
});

describe('byIdent', () => {
  it('finds a fix by identifier', () => {
    const results = resolver.byIdent('MERIT');
    assert.ok(results.length > 0, 'expected to find MERIT');
    assert.equal(results[0]!.identifier, 'MERIT');
  });

  it('is case-insensitive', () => {
    const results = resolver.byIdent('merit');
    assert.ok(results.length > 0, 'expected case-insensitive match');
    assert.equal(results[0]!.identifier, 'MERIT');
  });

  it('returns empty array for unknown identifier', () => {
    const results = resolver.byIdent('ZZZZZZZZZ');
    assert.equal(results.length, 0);
  });

  it('can return multiple fixes with the same identifier', () => {
    // Some fix identifiers exist in multiple ICAO regions
    const allResults = resolver.search({ text: 'A', limit: 10000 });
    const identCounts = new Map<string, number>();
    for (const fix of allResults) {
      identCounts.set(fix.identifier, (identCounts.get(fix.identifier) ?? 0) + 1);
    }
    const duplicates = Array.from(identCounts.entries()).filter(([, count]) => count > 1);
    if (duplicates.length > 0) {
      const [ident] = duplicates[0]!;
      const results = resolver.byIdent(ident);
      assert.ok(results.length >= 2, `expected multiple results for ${ident}`);
    }
  });
});

describe('nearest', () => {
  it('finds fixes near a known position', () => {
    // Near JFK airport
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781 });
    assert.ok(results.length > 0, 'expected nearby fixes');
  });

  it('returns results sorted by distance', () => {
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781 });
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i]!.distanceNm >= results[i - 1]!.distanceNm,
        'results should be sorted by ascending distance',
      );
    }
  });

  it('respects maxDistanceNm', () => {
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781, maxDistanceNm: 5 });
    for (const r of results) {
      assert.ok(r.distanceNm <= 5, `distance ${r.distanceNm} exceeds max of 5 nm`);
    }
  });

  it('respects limit', () => {
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781, limit: 3 });
    assert.ok(results.length <= 3, `expected at most 3 results, got ${results.length}`);
  });

  it('filters by use code', () => {
    const results = resolver.nearest({
      lat: 40.6413,
      lon: -73.7781,
      maxDistanceNm: 100,
      useCodes: new Set<FixUseCode>(['RP']),
    });
    for (const r of results) {
      assert.equal(r.fix.useCode, 'RP', `expected RP, got ${r.fix.useCode}`);
    }
  });

  it('returns empty array when no fixes are within range', () => {
    const results = resolver.nearest({ lat: 0, lon: -160, maxDistanceNm: 1 });
    assert.equal(results.length, 0);
  });

  it('includes distanceNm rounded to two decimal places', () => {
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781, limit: 5 });
    for (const r of results) {
      const rounded = Math.round(r.distanceNm * 100) / 100;
      assert.equal(r.distanceNm, rounded, 'distanceNm should be rounded to 2 decimal places');
    }
  });
});

describe('search', () => {
  it('finds fixes by identifier substring', () => {
    const results = resolver.search({ text: 'MERIT' });
    assert.ok(results.length > 0, 'expected results for MERIT');
    assert.ok(
      results.some((f) => f.identifier === 'MERIT'),
      'expected MERIT in results',
    );
  });

  it('is case-insensitive', () => {
    const lower = resolver.search({ text: 'merit' });
    const upper = resolver.search({ text: 'MERIT' });
    assert.equal(lower.length, upper.length, 'case should not affect results');
  });

  it('returns results sorted alphabetically by identifier', () => {
    const results = resolver.search({ text: 'BO' });
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i]!.identifier.localeCompare(results[i - 1]!.identifier) >= 0,
        'results should be sorted by identifier',
      );
    }
  });

  it('respects limit', () => {
    const results = resolver.search({ text: 'A', limit: 5 });
    assert.ok(results.length <= 5, `expected at most 5 results, got ${results.length}`);
  });

  it('filters by use code', () => {
    const results = resolver.search({
      text: 'A',
      useCodes: new Set<FixUseCode>(['VFR']),
    });
    for (const f of results) {
      assert.equal(f.useCode, 'VFR', `expected VFR, got ${f.useCode}`);
    }
  });

  it('returns empty array for empty search text', () => {
    const results = resolver.search({ text: '' });
    assert.equal(results.length, 0);
  });

  it('returns empty array for no matches', () => {
    const results = resolver.search({ text: 'xyznonexistent' });
    assert.equal(results.length, 0);
  });
});

describe('createFixResolver with empty dataset', () => {
  it('returns empty results for all lookups', () => {
    const empty = createFixResolver({ data: [] });
    assert.equal(empty.byIdent('MERIT').length, 0);
    assert.equal(empty.nearest({ lat: 0, lon: 0 }).length, 0);
    assert.equal(empty.search({ text: 'test' }).length, 0);
  });
});
