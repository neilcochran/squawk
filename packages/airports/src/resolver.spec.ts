import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Airport, FacilityType } from '@squawk/types';
import { createAirportResolver } from './resolver.js';
import type { AirportResolver } from './resolver.js';

/**
 * Loads the real airport-data dataset by importing the compiled package.
 * Tests in this file run against real FAA data to verify correctness.
 */
async function loadRealData(): Promise<Airport[]> {
  const { usBundledAirports } = await import('@squawk/airport-data');
  return usBundledAirports.records;
}

let resolver: AirportResolver;

before(async () => {
  const data = await loadRealData();
  resolver = createAirportResolver({ data });
});

describe('byFaaId', () => {
  it('finds JFK by FAA ID', () => {
    const result = resolver.byFaaId('JFK');
    assert.ok(result, 'expected to find JFK');
    assert.equal(result.faaId, 'JFK');
    assert.equal(result.icao, 'KJFK');
    assert.equal(result.facilityType, 'AIRPORT');
  });

  it('finds LAX by FAA ID', () => {
    const result = resolver.byFaaId('LAX');
    assert.ok(result, 'expected to find LAX');
    assert.equal(result.faaId, 'LAX');
    assert.equal(result.icao, 'KLAX');
  });

  it('is case-insensitive', () => {
    const result = resolver.byFaaId('jfk');
    assert.ok(result, 'expected case-insensitive match');
    assert.equal(result.faaId, 'JFK');
  });

  it('returns undefined for unknown ID', () => {
    const result = resolver.byFaaId('ZZZZZ');
    assert.equal(result, undefined);
  });
});

describe('byIcao', () => {
  it('finds KJFK by ICAO code', () => {
    const result = resolver.byIcao('KJFK');
    assert.ok(result, 'expected to find KJFK');
    assert.equal(result.icao, 'KJFK');
    assert.equal(result.faaId, 'JFK');
  });

  it('finds KORD by ICAO code', () => {
    const result = resolver.byIcao('KORD');
    assert.ok(result, 'expected to find KORD');
    assert.equal(result.icao, 'KORD');
    assert.equal(result.faaId, 'ORD');
  });

  it('is case-insensitive', () => {
    const result = resolver.byIcao('kjfk');
    assert.ok(result, 'expected case-insensitive match');
    assert.equal(result.icao, 'KJFK');
  });

  it('returns undefined for unknown ICAO code', () => {
    const result = resolver.byIcao('ZZZZ');
    assert.equal(result, undefined);
  });
});

describe('nearest', () => {
  it('finds airports near JFK', () => {
    // JFK coordinates: 40.6413 N, 73.7781 W
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781 });
    assert.ok(results.length > 0, 'expected nearby airports');
    // JFK itself should be the closest (distance ~0)
    assert.equal(results[0]!.airport.faaId, 'JFK');
    assert.ok(results[0]!.distanceNm < 1, 'JFK should be within 1 nm of itself');
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

  it('filters by facility type', () => {
    const results = resolver.nearest({
      lat: 40.6413,
      lon: -73.7781,
      maxDistanceNm: 50,
      types: new Set<FacilityType>(['HELIPORT']),
    });
    for (const r of results) {
      assert.equal(
        r.airport.facilityType,
        'HELIPORT',
        `expected HELIPORT, got ${r.airport.facilityType}`,
      );
    }
  });

  it('returns empty array when no airports are within range', () => {
    // Middle of the Pacific Ocean
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
  it('finds airports by city name', () => {
    const results = resolver.search({ text: 'chicago' });
    assert.ok(results.length > 0, 'expected results for chicago');
    assert.ok(
      results.some((a) => a.faaId === 'ORD'),
      'expected ORD in chicago results',
    );
  });

  it('finds airports by facility name', () => {
    const results = resolver.search({ text: 'john f kennedy' });
    assert.ok(results.length > 0, 'expected results for john f kennedy');
    assert.ok(
      results.some((a) => a.faaId === 'JFK'),
      'expected JFK in results',
    );
  });

  it('is case-insensitive', () => {
    const lower = resolver.search({ text: 'los angeles' });
    const upper = resolver.search({ text: 'LOS ANGELES' });
    assert.equal(lower.length, upper.length, 'case should not affect results');
  });

  it('returns results sorted alphabetically by name', () => {
    const results = resolver.search({ text: 'new york' });
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i]!.name.localeCompare(results[i - 1]!.name) >= 0,
        'results should be sorted by name',
      );
    }
  });

  it('respects limit', () => {
    const results = resolver.search({ text: 'airport', limit: 5 });
    assert.ok(results.length <= 5, `expected at most 5 results, got ${results.length}`);
  });

  it('filters by facility type', () => {
    const results = resolver.search({
      text: 'new york',
      types: new Set<FacilityType>(['HELIPORT']),
    });
    for (const a of results) {
      assert.equal(a.facilityType, 'HELIPORT', `expected HELIPORT, got ${a.facilityType}`);
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

describe('createAirportResolver with empty dataset', () => {
  it('returns undefined for all lookups', () => {
    const empty = createAirportResolver({ data: [] });
    assert.equal(empty.byFaaId('JFK'), undefined);
    assert.equal(empty.byIcao('KJFK'), undefined);
    assert.equal(empty.nearest({ lat: 0, lon: 0 }).length, 0);
    assert.equal(empty.search({ text: 'test' }).length, 0);
  });
});
