import { describe, it, beforeAll, expect, assert } from 'vitest';

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

beforeAll(async () => {
  const data = await loadRealData();
  resolver = createAirportResolver({ data });
});

describe('byFaaId', () => {
  it('finds JFK by FAA ID', () => {
    const result = resolver.byFaaId('JFK');
    assert(result, 'expected to find JFK');
    expect(result.faaId).toBe('JFK');
    expect(result.icao).toBe('KJFK');
    expect(result.facilityType).toBe('AIRPORT');
    expect(result.timezone).toBe('America/New_York');
  });

  it('finds LAX by FAA ID', () => {
    const result = resolver.byFaaId('LAX');
    assert(result, 'expected to find LAX');
    expect(result.faaId).toBe('LAX');
    expect(result.icao).toBe('KLAX');
  });

  it('is case-insensitive', () => {
    const result = resolver.byFaaId('jfk');
    assert(result, 'expected case-insensitive match');
    expect(result.faaId).toBe('JFK');
  });

  it('returns undefined for unknown ID', () => {
    const result = resolver.byFaaId('ZZZZZ');
    expect(result).toBe(undefined);
  });
});

describe('byIcao', () => {
  it('finds KJFK by ICAO code', () => {
    const result = resolver.byIcao('KJFK');
    assert(result, 'expected to find KJFK');
    expect(result.icao).toBe('KJFK');
    expect(result.faaId).toBe('JFK');
  });

  it('finds KORD by ICAO code', () => {
    const result = resolver.byIcao('KORD');
    assert(result, 'expected to find KORD');
    expect(result.icao).toBe('KORD');
    expect(result.faaId).toBe('ORD');
  });

  it('is case-insensitive', () => {
    const result = resolver.byIcao('kjfk');
    assert(result, 'expected case-insensitive match');
    expect(result.icao).toBe('KJFK');
  });

  it('returns undefined for unknown ICAO code', () => {
    const result = resolver.byIcao('ZZZZ');
    expect(result).toBe(undefined);
  });
});

describe('nearest', () => {
  it('finds airports near JFK', () => {
    // JFK coordinates: 40.6413 N, 73.7781 W
    const results = resolver.nearest({ lat: 40.6413, lon: -73.7781 });
    assert(results.length > 0, 'expected nearby airports');
    // JFK itself should be the closest (distance ~0)
    expect(results[0]!.airport.faaId).toBe('JFK');
    assert(results[0]!.distanceNm < 1, 'JFK should be within 1 nm of itself');
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

  it('filters by facility type', () => {
    const results = resolver.nearest({
      lat: 40.6413,
      lon: -73.7781,
      maxDistanceNm: 50,
      types: new Set<FacilityType>(['HELIPORT']),
    });
    for (const r of results) {
      expect(r.airport.facilityType, `expected HELIPORT, got ${r.airport.facilityType}`).toBe(
        'HELIPORT',
      );
    }
  });

  it('returns empty array when no airports are within range', () => {
    // Middle of the Pacific Ocean
    const results = resolver.nearest({ lat: 0, lon: -160, maxDistanceNm: 1 });
    expect(results.length).toBe(0);
  });

  it('filters by minimum runway length', () => {
    // JFK area - request only airports with runways >= 10000 ft (major airports)
    const results = resolver.nearest({
      lat: 40.6413,
      lon: -73.7781,
      maxDistanceNm: 30,
      minRunwayLengthFt: 10000,
    });
    assert(results.length > 0, 'expected results with long runways');
    for (const r of results) {
      const hasLongRunway = r.airport.runways.some(
        (rwy) => rwy.lengthFt !== undefined && rwy.lengthFt >= 10000,
      );
      assert(hasLongRunway, `${r.airport.faaId} should have a runway >= 10000 ft`);
    }
  });

  it('filters by minimum runway length combined with facility type', () => {
    const results = resolver.nearest({
      lat: 40.6413,
      lon: -73.7781,
      maxDistanceNm: 50,
      minRunwayLengthFt: 5000,
      types: new Set<FacilityType>(['AIRPORT']),
    });
    for (const r of results) {
      expect(r.airport.facilityType).toBe('AIRPORT');
      const meetsLength = r.airport.runways.some(
        (rwy) => rwy.lengthFt !== undefined && rwy.lengthFt >= 5000,
      );
      assert(meetsLength, `${r.airport.faaId} should have a runway >= 5000 ft`);
    }
  });

  it('returns empty array when no airports meet runway length requirement', () => {
    // No airport has a 100,000 ft runway
    const results = resolver.nearest({
      lat: 40.6413,
      lon: -73.7781,
      maxDistanceNm: 30,
      minRunwayLengthFt: 100000,
    });
    expect(results.length).toBe(0);
  });

  it('excludes airports where all runways have undefined length', () => {
    // Heliports typically have no runway length data - using a high minRunwayLengthFt of 1
    // combined with heliport filter should return nothing since heliport "runways" lack lengthFt
    const results = resolver.nearest({
      lat: 40.6413,
      lon: -73.7781,
      maxDistanceNm: 50,
      minRunwayLengthFt: 1,
      types: new Set<FacilityType>(['HELIPORT']),
    });
    for (const r of results) {
      const hasDefinedLength = r.airport.runways.some((rwy) => rwy.lengthFt !== undefined);
      assert(
        hasDefinedLength,
        `${r.airport.faaId} should not appear without a runway with defined length`,
      );
    }
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
  it('finds airports by city name', () => {
    const results = resolver.search({ text: 'chicago' });
    assert(results.length > 0, 'expected results for chicago');
    assert(
      results.some((a) => a.faaId === 'ORD'),
      'expected ORD in chicago results',
    );
  });

  it('finds airports by facility name', () => {
    const results = resolver.search({ text: 'john f kennedy' });
    assert(results.length > 0, 'expected results for john f kennedy');
    assert(
      results.some((a) => a.faaId === 'JFK'),
      'expected JFK in results',
    );
  });

  it('is case-insensitive', () => {
    const lower = resolver.search({ text: 'los angeles' });
    const upper = resolver.search({ text: 'LOS ANGELES' });
    expect(lower.length, 'case should not affect results').toBe(upper.length);
  });

  it('returns results sorted alphabetically by name', () => {
    const results = resolver.search({ text: 'new york' });
    for (let i = 1; i < results.length; i++) {
      assert(
        results[i]!.name.localeCompare(results[i - 1]!.name) >= 0,
        'results should be sorted by name',
      );
    }
  });

  it('respects limit', () => {
    const results = resolver.search({ text: 'airport', limit: 5 });
    assert(results.length <= 5, `expected at most 5 results, got ${results.length}`);
  });

  it('filters by facility type', () => {
    const results = resolver.search({
      text: 'new york',
      types: new Set<FacilityType>(['HELIPORT']),
    });
    for (const a of results) {
      expect(a.facilityType, `expected HELIPORT, got ${a.facilityType}`).toBe('HELIPORT');
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

describe('createAirportResolver with empty dataset', () => {
  it('returns undefined for all lookups', () => {
    const empty = createAirportResolver({ data: [] });
    expect(empty.byFaaId('JFK')).toBe(undefined);
    expect(empty.byIcao('KJFK')).toBe(undefined);
    expect(empty.nearest({ lat: 0, lon: 0 }).length).toBe(0);
    expect(empty.search({ text: 'test' }).length).toBe(0);
  });
});
