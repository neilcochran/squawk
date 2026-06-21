import { describe, it, beforeAll, expect, assert } from 'vitest';

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
    assert(results.length > 0, 'expected to find MERIT');
    expect(results[0]!.identifier).toBe('MERIT');
  });

  it('is case-insensitive', () => {
    const results = resolver.byIdent('merit');
    assert(results.length > 0, 'expected case-insensitive match');
    expect(results[0]!.identifier).toBe('MERIT');
  });

  it('returns empty array for unknown identifier', () => {
    const results = resolver.byIdent('ZZZZZZZZZ');
    expect(results.length).toBe(0);
  });

  it('can return multiple fixes with the same identifier', () => {
    // Some fix identifiers exist in multiple ICAO regions
    const allResults = resolver.search({ text: 'A', limit: 10000 });
    const identCounts = new Map<string, number>();
    for (const { fix } of allResults) {
      identCounts.set(fix.identifier, (identCounts.get(fix.identifier) ?? 0) + 1);
    }
    const duplicates = Array.from(identCounts.entries()).filter(([, count]) => count > 1);
    if (duplicates.length > 0) {
      const [ident] = duplicates[0]!;
      const results = resolver.byIdent(ident);
      assert(results.length >= 2, `expected multiple results for ${ident}`);
    }
  });
});

describe('byIdentAtPosition', () => {
  /**
   * Builds a minimal synthetic fix at a given position. US fix identifiers
   * are unique within the bundled dataset, so a shared identifier across
   * distinct positions has to be constructed to exercise nearest-wins
   * disambiguation.
   */
  function makeFix(identifier: string, lat: number, lon: number): Fix {
    return {
      identifier,
      icaoRegionCode: 'K1',
      country: 'US',
      lat,
      lon,
      useCode: 'RP',
      pitch: false,
      catch: false,
      suaAtcaa: false,
      chartTypes: [],
      navaidAssociations: [],
    };
  }

  it('returns the match nearest to the query position when an identifier is shared', () => {
    const east = makeFix('DUPE', 40, -74);
    const west = makeFix('DUPE', 34, -118);
    const local = createFixResolver({ data: [east, west] });

    const nearEast = local.byIdentAtPosition('DUPE', 40.5, -74.5);
    const nearWest = local.byIdentAtPosition('DUPE', 33.5, -117.5);
    assert(nearEast !== undefined && nearWest !== undefined, 'expected a match near each position');
    expect(nearEast.lat).toBe(east.lat);
    expect(nearEast.lon).toBe(east.lon);
    expect(nearWest.lat).toBe(west.lat);
    expect(nearWest.lon).toBe(west.lon);
  });

  it('is case-insensitive', () => {
    const match = resolver.byIdent('MERIT')[0];
    assert(match !== undefined, 'expected a MERIT fix');
    const upper = resolver.byIdentAtPosition('MERIT', match.lat, match.lon);
    const lower = resolver.byIdentAtPosition('merit', match.lat, match.lon);
    assert(upper !== undefined && lower !== undefined, 'expected case-insensitive MERIT match');
    expect(lower.identifier).toBe('MERIT');
  });

  it('returns undefined for an unknown identifier', () => {
    expect(resolver.byIdentAtPosition('ZZZZZZZZZ', 0, 0)).toBeUndefined();
  });

  it('returns the nearest match regardless of distance when no tolerance is given', () => {
    // Query from the mid-Pacific; the nearest MERIT record still wins.
    const result = resolver.byIdentAtPosition('MERIT', 0, -160);
    assert(result !== undefined, 'expected a match with no tolerance');
    assert(
      resolver.byIdent('MERIT').some((f) => f.lat === result.lat && f.lon === result.lon),
      'result should be one of the MERIT records',
    );
  });

  it('excludes matches beyond the tolerance', () => {
    // Mid-Pacific query with a 5 nm tolerance: no MERIT record is that close.
    expect(resolver.byIdentAtPosition('MERIT', 0, -160, 5)).toBeUndefined();
  });

  it('returns the match when it falls within the tolerance', () => {
    const match = resolver.byIdent('MERIT')[0];
    assert(match !== undefined, 'expected a MERIT fix');
    const result = resolver.byIdentAtPosition('MERIT', match.lat, match.lon, 1);
    assert(result !== undefined, 'expected a within-tolerance match');
    expect(result.lat).toBe(match.lat);
    expect(result.lon).toBe(match.lon);
  });
});

describe('nearest', () => {
  it('finds fixes near a known position', () => {
    // Near JFK airport
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781 });
    assert(results.length > 0, 'expected nearby fixes');
  });

  it('returns results sorted by distance', () => {
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781 });
    for (let i = 1; i < results.length; i++) {
      assert(
        results[i]!.distanceNm >= results[i - 1]!.distanceNm,
        'results should be sorted by ascending distance',
      );
    }
  });

  it('respects maxDistanceNm', () => {
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781, maxDistanceNm: 5 });
    for (const r of results) {
      assert(r.distanceNm <= 5, `distance ${r.distanceNm} exceeds max of 5 nm`);
    }
  });

  it('respects limit', () => {
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781, limit: 3 });
    assert(results.length <= 3, `expected at most 3 results, got ${results.length}`);
  });

  it('filters by use code', () => {
    const results = resolver.nearest({
      lat: 40.6413,
      lon: -73.7781,
      maxDistanceNm: 100,
      useCodes: new Set<FixUseCode>(['RP']),
    });
    for (const r of results) {
      expect(r.fix.useCode, `expected RP, got ${r.fix.useCode}`).toBe('RP');
    }
  });

  it('returns empty array when no fixes are within range', () => {
    const results = resolver.nearest({ lat: 0, lon: -160, maxDistanceNm: 1 });
    expect(results.length).toBe(0);
  });

  it('includes distanceNm rounded to two decimal places', () => {
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781, limit: 5 });
    for (const r of results) {
      const rounded = Math.round(r.distanceNm * 100) / 100;
      expect(r.distanceNm, 'distanceNm should be rounded to 2 decimal places').toBe(rounded);
    }
  });
});

describe('search', () => {
  it('ranks an exact identifier match first with field and ranges', () => {
    const results = resolver.search({ text: 'MERIT' });
    assert(results.length > 0, 'expected results for MERIT');
    expect(results[0]!.fix.identifier).toBe('MERIT');
    expect(results[0]!.matchedField).toBe('identifier');
    expect(results[0]!.score).toBe(1);
    expect(results[0]!.ranges).toEqual([{ start: 0, end: 5 }]);
  });

  it('is case-insensitive', () => {
    const lower = resolver.search({ text: 'merit' });
    const upper = resolver.search({ text: 'MERIT' });
    expect(lower.length, 'case should not affect results').toBe(upper.length);
  });

  it('returns results sorted by descending score', () => {
    const results = resolver.search({ text: 'BO' });
    for (let i = 1; i < results.length; i++) {
      assert(
        results[i]!.score <= results[i - 1]!.score,
        'results should be sorted by descending score',
      );
    }
  });

  it('respects limit', () => {
    const results = resolver.search({ text: 'A', limit: 5 });
    assert(results.length <= 5, `expected at most 5 results, got ${results.length}`);
  });

  it('filters by use code', () => {
    const results = resolver.search({
      text: 'A',
      useCodes: new Set<FixUseCode>(['VFR']),
    });
    for (const r of results) {
      expect(r.fix.useCode, `expected VFR, got ${r.fix.useCode}`).toBe('VFR');
    }
  });

  it('keeps only matches above the minScore threshold', () => {
    const lenient = resolver.search({ text: 'MERIT' });
    const strict = resolver.search({ text: 'MERIT', minScore: 0.5 });
    assert(strict.length <= lenient.length, 'raising minScore should not add results');
    for (const r of strict) {
      assert(r.score > 0.5, `expected score > 0.5, got ${r.score}`);
    }
  });

  it('returns empty array for empty search text', () => {
    const results = resolver.search({ text: '' });
    expect(results.length).toBe(0);
  });

  it('returns empty array for no matches', () => {
    const results = resolver.search({ text: 'xyznonexistent' });
    expect(results.length).toBe(0);
  });
});

describe('createFixResolver with empty dataset', () => {
  it('returns empty results for all lookups', () => {
    const empty = createFixResolver({ data: [] });
    expect(empty.byIdent('MERIT').length).toBe(0);
    expect(empty.byIdentAtPosition('MERIT', 0, 0)).toBeUndefined();
    expect(empty.nearest({ lat: 0, lon: 0 }).length).toBe(0);
    expect(empty.search({ text: 'test' }).length).toBe(0);
  });
});
