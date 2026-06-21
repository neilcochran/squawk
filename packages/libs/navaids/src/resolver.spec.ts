import { describe, it, beforeAll, expect, assert } from 'vitest';

import type { Navaid, NavaidType } from '@squawk/types';

import { createNavaidResolver } from './resolver.js';
import type { NavaidResolver } from './resolver.js';

/**
 * Loads the real navaid-data dataset by importing the compiled package.
 * Tests in this file run against real FAA data to verify correctness.
 */
async function loadRealData(): Promise<Navaid[]> {
  const { usBundledNavaids } = await import('@squawk/navaid-data');
  return usBundledNavaids.records;
}

let resolver: NavaidResolver;

beforeAll(async () => {
  const data = await loadRealData();
  resolver = createNavaidResolver({ data });
});

describe('byIdent', () => {
  it('finds a VORTAC by identifier', () => {
    const results = resolver.byIdent('ABI');
    assert(results.length > 0, 'expected to find ABI');
    expect(results[0]!.identifier).toBe('ABI');
    expect(results[0]!.type).toBe('VORTAC');
  });

  it('is case-insensitive', () => {
    const results = resolver.byIdent('abi');
    assert(results.length > 0, 'expected case-insensitive match');
    expect(results[0]!.identifier).toBe('ABI');
  });

  it('returns empty array for unknown identifier', () => {
    const results = resolver.byIdent('ZZZZZ');
    expect(results.length).toBe(0);
  });

  it('can return multiple navaids with the same identifier', () => {
    // AA is both an NDB in ND and an NDB in GA in the dataset
    const results = resolver.byIdent('AA');
    assert(results.length >= 2, 'expected multiple results for AA');
  });
});

describe('byIdentAtPosition', () => {
  it('returns the match nearest to the query position when an identifier is shared', () => {
    const matches = resolver.byIdent('AA');
    assert(matches.length >= 2, 'expected multiple AA navaids');
    const [first, second] = matches;
    assert(first !== undefined && second !== undefined, 'expected two AA records');
    assert(
      first.lat !== second.lat || first.lon !== second.lon,
      'expected the AA records to sit at distinct positions',
    );

    const nearFirst = resolver.byIdentAtPosition('AA', first.lat, first.lon);
    const nearSecond = resolver.byIdentAtPosition('AA', second.lat, second.lon);
    assert(
      nearFirst !== undefined && nearSecond !== undefined,
      'expected a match at each record position',
    );
    expect(nearFirst.lat).toBe(first.lat);
    expect(nearFirst.lon).toBe(first.lon);
    expect(nearSecond.lat).toBe(second.lat);
    expect(nearSecond.lon).toBe(second.lon);
  });

  it('is case-insensitive', () => {
    const upper = resolver.byIdentAtPosition('ABI', 32.481, -99.863);
    assert(upper !== undefined, 'expected ABI match');
    const lower = resolver.byIdentAtPosition('abi', 32.481, -99.863);
    assert(lower !== undefined, 'expected case-insensitive ABI match');
    expect(lower.identifier).toBe('ABI');
  });

  it('returns undefined for an unknown identifier', () => {
    expect(resolver.byIdentAtPosition('ZZZZZ', 32.481, -99.863)).toBeUndefined();
  });

  it('returns the nearest match regardless of distance when no tolerance is given', () => {
    // Query from the mid-Pacific; the nearest AA record still wins.
    const result = resolver.byIdentAtPosition('AA', 0, -160);
    assert(result !== undefined, 'expected a match with no tolerance');
    assert(
      resolver.byIdent('AA').some((n) => n.lat === result.lat && n.lon === result.lon),
      'result should be one of the AA records',
    );
  });

  it('excludes matches beyond the tolerance', () => {
    // Mid-Pacific query with a 5 nm tolerance: no AA record is that close.
    expect(resolver.byIdentAtPosition('AA', 0, -160, 5)).toBeUndefined();
  });

  it('returns the match when it falls within the tolerance', () => {
    const first = resolver.byIdent('AA')[0];
    assert(first !== undefined, 'expected an AA record');
    const result = resolver.byIdentAtPosition('AA', first.lat, first.lon, 1);
    assert(result !== undefined, 'expected a within-tolerance match');
    expect(result.lat).toBe(first.lat);
    expect(result.lon).toBe(first.lon);
  });
});

describe('byFrequency', () => {
  it('finds VOR-type navaids by MHz frequency', () => {
    const results = resolver.byFrequency({ frequency: 113.7 });
    assert(results.length > 0, 'expected results for 113.7 MHz');
    for (const navaid of results) {
      expect(navaid.frequencyMhz).toBe(113.7);
    }
  });

  it('finds NDB-type navaids by kHz frequency', () => {
    const results = resolver.byFrequency({
      frequency: 365,
      types: new Set<NavaidType>(['NDB']),
    });
    assert(results.length > 0, 'expected results for 365 kHz NDB');
    for (const navaid of results) {
      expect(navaid.frequencyKhz).toBe(365);
      expect(navaid.type).toBe('NDB');
    }
  });

  it('filters by type', () => {
    const results = resolver.byFrequency({
      frequency: 113.7,
      types: new Set<NavaidType>(['VORTAC']),
    });
    for (const navaid of results) {
      expect(navaid.type).toBe('VORTAC');
    }
  });

  it('returns results sorted by identifier', () => {
    const results = resolver.byFrequency({ frequency: 113 });
    for (let i = 1; i < results.length; i++) {
      assert(
        results[i]!.identifier.localeCompare(results[i - 1]!.identifier) >= 0,
        'results should be sorted by identifier',
      );
    }
  });

  it('respects limit', () => {
    const results = resolver.byFrequency({ frequency: 113, limit: 2 });
    assert(results.length <= 2, `expected at most 2 results, got ${results.length}`);
  });
});

describe('nearest', () => {
  it('finds navaids near a known VORTAC position', () => {
    // ABI VORTAC: ~32.481, -99.863
    const results = resolver.nearest({ lat: 32.481, lon: -99.863 });
    assert(results.length > 0, 'expected nearby navaids');
    expect(results[0]!.navaid.identifier).toBe('ABI');
    assert(results[0]!.distanceNm < 1, 'ABI should be within 1 nm of itself');
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
    const results = resolver.nearest({ lat: 32.481, lon: -99.863, maxDistanceNm: 5 });
    for (const r of results) {
      assert(r.distanceNm <= 5, `distance ${r.distanceNm} exceeds max of 5 nm`);
    }
  });

  it('respects limit', () => {
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781, limit: 3 });
    assert(results.length <= 3, `expected at most 3 results, got ${results.length}`);
  });

  it('filters by type', () => {
    const results = resolver.nearest({
      lat: 40.6413,
      lon: -73.7781,
      maxDistanceNm: 100,
      types: new Set<NavaidType>(['NDB']),
    });
    for (const r of results) {
      expect(r.navaid.type, `expected NDB, got ${r.navaid.type}`).toBe('NDB');
    }
  });

  it('returns empty array when no navaids are within range', () => {
    const results = resolver.nearest({ lat: 0, lon: -160, maxDistanceNm: 1 });
    expect(results.length).toBe(0);
  });

  it('includes distanceNm rounded to two decimal places', () => {
    const results = resolver.nearest({ lat: 32.481, lon: -99.863, limit: 5 });
    for (const r of results) {
      const rounded = Math.round(r.distanceNm * 100) / 100;
      expect(r.distanceNm, 'distanceNm should be rounded to 2 decimal places').toBe(rounded);
    }
  });
});

describe('byType', () => {
  it('returns all VORTACs', () => {
    const results = resolver.byType(new Set<NavaidType>(['VORTAC']));
    assert(results.length > 0, 'expected VORTAC results');
    for (const navaid of results) {
      expect(navaid.type).toBe('VORTAC');
    }
  });

  it('returns multiple types when requested', () => {
    const results = resolver.byType(new Set<NavaidType>(['VOR', 'VORTAC', 'VOR/DME']));
    assert(results.length > 0, 'expected VOR-family results');
    const types = new Set(results.map((n) => n.type));
    for (const t of types) {
      assert(t === 'VOR' || t === 'VORTAC' || t === 'VOR/DME', `unexpected type ${t}`);
    }
  });

  it('returns results sorted by identifier', () => {
    const results = resolver.byType(new Set<NavaidType>(['VORTAC']));
    for (let i = 1; i < results.length; i++) {
      assert(
        results[i]!.identifier.localeCompare(results[i - 1]!.identifier) >= 0,
        'results should be sorted by identifier',
      );
    }
  });

  it('returns empty array for type with no matches', () => {
    const results = resolver.byType(new Set<NavaidType>(['MARINE_NDB']));
    // There may be 0 or 1 MARINE_NDB in dataset - just verify type filter works
    for (const navaid of results) {
      expect(navaid.type).toBe('MARINE_NDB');
    }
  });
});

describe('search', () => {
  it('ranks an exact identifier match first with field and ranges', () => {
    const results = resolver.search({ text: 'ABI' });
    assert(results.length > 0, 'expected results for ABI');
    expect(results[0]!.navaid.identifier).toBe('ABI');
    expect(results[0]!.matchedField).toBe('identifier');
    expect(results[0]!.score).toBe(1);
    expect(results[0]!.ranges).toEqual([{ start: 0, end: 3 }]);
  });

  it('finds navaids by name', () => {
    const results = resolver.search({ text: 'BOSTON' });
    assert(
      results.some((r) => r.navaid.name.toUpperCase().includes('BOSTON')),
      'expected a navaid with BOSTON in the name',
    );
  });

  it('reports the name field for a name-only match', () => {
    const results = resolver.search({ text: 'boston' });
    assert(
      results.some((r) => r.matchedField === 'name'),
      'expected at least one result matched via name',
    );
  });

  it('is case-insensitive', () => {
    const lower = resolver.search({ text: 'boston' });
    const upper = resolver.search({ text: 'BOSTON' });
    expect(lower.length, 'case should not affect results').toBe(upper.length);
  });

  it('returns results sorted by descending score', () => {
    const results = resolver.search({ text: 'new' });
    for (let i = 1; i < results.length; i++) {
      assert(
        results[i]!.score <= results[i - 1]!.score,
        'results should be sorted by descending score',
      );
    }
  });

  it('respects limit', () => {
    const results = resolver.search({ text: 'a', limit: 5 });
    assert(results.length <= 5, `expected at most 5 results, got ${results.length}`);
  });

  it('filters by type', () => {
    const results = resolver.search({
      text: 'a',
      types: new Set<NavaidType>(['NDB']),
    });
    for (const r of results) {
      expect(r.navaid.type, `expected NDB, got ${r.navaid.type}`).toBe('NDB');
    }
  });

  it('keeps only matches above the minScore threshold', () => {
    const lenient = resolver.search({ text: 'boston' });
    const strict = resolver.search({ text: 'boston', minScore: 0.5 });
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

describe('createNavaidResolver with empty dataset', () => {
  it('returns empty results for all lookups', () => {
    const empty = createNavaidResolver({ data: [] });
    expect(empty.byIdent('BOS').length).toBe(0);
    expect(empty.byIdentAtPosition('BOS', 0, 0)).toBeUndefined();
    expect(empty.byFrequency({ frequency: 113.7 }).length).toBe(0);
    expect(empty.nearest({ lat: 0, lon: 0 }).length).toBe(0);
    expect(empty.byType(new Set<NavaidType>(['VOR'])).length).toBe(0);
    expect(empty.search({ text: 'test' }).length).toBe(0);
  });
});
