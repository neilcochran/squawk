import { assert, describe, expect, it } from 'vitest';

import type { Aircraft, Coordinates } from '@squawk/types';

import { filterAircraft, matchesFilter, parseFilter } from './filter.js';
import type { AircraftFilter, FilterError } from './filter.js';
import type { UnitSystem } from './units.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

function isError(result: AircraftFilter | FilterError): result is FilterError {
  return 'message' in result;
}

function parse(text: string, hasLocation = true, units: UnitSystem = 'aviation'): AircraftFilter {
  const result = parseFilter(text, hasLocation, units);
  assert(!isError(result), 'message' in result ? result.message : 'expected a filter');
  return result;
}

const LOCATION: Coordinates = { lat: 0, lon: 0 };

describe('parseFilter', () => {
  it('treats bare words as free-text terms and keeps the trimmed text', () => {
    const filter = parse('  UAL 7700 ');
    expect(filter.text).toBe('UAL 7700');
    expect(filter.terms).toEqual(['UAL', '7700']);
    expect(filter.onGround).toBeUndefined();
    expect(filter.emergencyOnly).toBe(false);
    expect(filter.withinNm).toBeUndefined();
    expect(filter.minAltitudeFt).toBeUndefined();
    expect(filter.maxAltitudeFt).toBeUndefined();
  });

  it('parses alt: as a floor, a ceiling, or an inclusive range', () => {
    expect(parse('alt:>5000')).toMatchObject({ minAltitudeFt: 5000, maxAltitudeFt: undefined });
    expect(parse('alt:<10000')).toMatchObject({ minAltitudeFt: undefined, maxAltitudeFt: 10000 });
    expect(parse('alt:5000-10000')).toMatchObject({ minAltitudeFt: 5000, maxAltitudeFt: 10000 });
    expect(parse('alt:>5000 alt:<10000')).toMatchObject({
      minAltitudeFt: 5000,
      maxAltitudeFt: 10000,
    });
  });

  it('reads a bare alt: value in the active unit system, with a suffix overriding it', () => {
    expect(parse('alt:>1000', true, 'metric').minAltitudeFt).toBeCloseTo(3280.84, 1);
    expect(parse('alt:>1000ft', true, 'metric').minAltitudeFt).toBe(1000);
    expect(parse('alt:1000-2000m', true, 'aviation')).toMatchObject({
      minAltitudeFt: expect.closeTo(3280.84, 1),
      maxAltitudeFt: expect.closeTo(6561.68, 1),
    });
  });

  it('rejects a malformed or inverted alt: value', () => {
    for (const text of ['alt:', 'alt:5000', 'alt:>abc', 'alt:10000-5000', 'alt:>10000 alt:<5000']) {
      const result = parseFilter(text, true, 'aviation');
      expect(isError(result)).toBe(true);
    }
    const inverted = parseFilter('alt:10000-5000', true, 'aviation');
    if (isError(inverted)) {
      expect(inverted.message).toContain('floor is above its ceiling');
    }
  });

  it('parses is:airborne and is:ground, including their aliases, case-insensitively', () => {
    expect(parse('is:airborne').onGround).toBe(false);
    expect(parse('IS:Air').onGround).toBe(false);
    expect(parse('is:ground').onGround).toBe(true);
    expect(parse('is:GND').onGround).toBe(true);
  });

  it('parses is:emergency and its alias', () => {
    expect(parse('is:emergency').emergencyOnly).toBe(true);
    expect(parse('is:emerg').emergencyOnly).toBe(true);
  });

  it('parses within:<distance> when a location is configured, with an optional unit suffix', () => {
    expect(parse('within:25').withinNm).toBe(25);
    expect(parse('within:2.5').withinNm).toBe(2.5);
    expect(parse('within:25nm').withinNm).toBe(25);
    expect(parse('within:100km').withinNm).toBeCloseTo(53.996, 2);
    expect(parse('within:100KM').withinNm).toBeCloseTo(53.996, 2);
  });

  it('reads a bare within: value in the active unit system, with a suffix overriding it', () => {
    expect(parse('within:100', true, 'metric').withinNm).toBeCloseTo(53.996, 2);
    expect(parse('within:100nm', true, 'metric').withinNm).toBe(100);
    expect(parse('within:100km', true, 'aviation').withinNm).toBeCloseTo(53.996, 2);
  });

  it('combines qualifiers and free text', () => {
    const filter = parse('is:air within:30 dal is:emerg');
    expect(filter.terms).toEqual(['dal']);
    expect(filter.onGround).toBe(false);
    expect(filter.emergencyOnly).toBe(true);
    expect(filter.withinNm).toBe(30);
  });

  it('rejects within: without a location', () => {
    const result = parseFilter('within:25', false, 'aviation');
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain('--lat/--lon');
    }
  });

  it('rejects a malformed within: value', () => {
    for (const text of ['within:', 'within:abc', 'within:-5']) {
      const result = parseFilter(text, true, 'aviation');
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.message).toContain('Invalid distance');
      }
    }
  });

  it('rejects an unknown is: value', () => {
    const result = parseFilter('is:flying', true, 'aviation');
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain('Unknown state "flying"');
    }
  });

  it('rejects contradictory is:airborne and is:ground', () => {
    const result = parseFilter('is:airborne is:ground', true, 'aviation');
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain('cannot both apply');
    }
  });

  it('rejects an unknown qualifier', () => {
    const result = parseFilter('speed:300', true, 'aviation');
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain('Unknown qualifier "speed:"');
    }
  });
});

describe('matchesFilter', () => {
  it('keeps only airborne aircraft for is:airborne, treating unknown as airborne', () => {
    const filter = parse('is:airborne');
    expect(matchesFilter(makeAircraft({ onGround: false }), filter, undefined)).toBe(true);
    expect(matchesFilter(makeAircraft(), filter, undefined)).toBe(true);
    expect(matchesFilter(makeAircraft({ onGround: true }), filter, undefined)).toBe(false);
  });

  it('keeps only on-ground aircraft for is:ground', () => {
    const filter = parse('is:ground');
    expect(matchesFilter(makeAircraft({ onGround: true }), filter, undefined)).toBe(true);
    expect(matchesFilter(makeAircraft(), filter, undefined)).toBe(false);
  });

  it('keeps only emergency aircraft for is:emergency', () => {
    const filter = parse('is:emergency');
    expect(matchesFilter(makeAircraft({ squawk: '7700' }), filter, undefined)).toBe(true);
    expect(matchesFilter(makeAircraft({ squawk: '1200' }), filter, undefined)).toBe(false);
  });

  it('keeps only aircraft within the distance limit, excluding those with no position', () => {
    const filter = parse('within:100');
    expect(matchesFilter(makeAircraft({ position: { lat: 1, lon: 0 } }), filter, LOCATION)).toBe(
      true,
    );
    expect(matchesFilter(makeAircraft({ position: { lat: 2, lon: 0 } }), filter, LOCATION)).toBe(
      false,
    );
    expect(matchesFilter(makeAircraft(), filter, LOCATION)).toBe(false);
  });

  it('keeps only aircraft inside the altitude bounds, excluding those with no altitude', () => {
    const between = parse('alt:5000-10000');
    const at = (baroAltitudeFt: number): Aircraft =>
      makeAircraft({ position: { lat: 0, lon: 0, baroAltitudeFt } });
    expect(matchesFilter(at(7500), between, undefined)).toBe(true);
    expect(matchesFilter(at(5000), between, undefined)).toBe(false);
    expect(matchesFilter(at(10000), between, undefined)).toBe(false);
    expect(matchesFilter(makeAircraft(), between, undefined)).toBe(false);

    const above = parse('alt:>5000');
    expect(matchesFilter(at(5001), above, undefined)).toBe(true);
    expect(matchesFilter(at(5000), above, undefined)).toBe(false);

    const geoOnly = makeAircraft({ position: { lat: 0, lon: 0, geoAltitudeFt: 7500 } });
    expect(matchesFilter(geoOnly, between, undefined)).toBe(true);
  });

  it('requires every free-text term to match', () => {
    const filter = parse('ual 111');
    expect(matchesFilter(makeAircraft({ callsign: 'UAL111' }), filter, undefined)).toBe(true);
    expect(matchesFilter(makeAircraft({ callsign: 'UAL222' }), filter, undefined)).toBe(false);
  });

  it('requires every part to match when combined', () => {
    const filter = parse('is:airborne ual');
    expect(matchesFilter(makeAircraft({ callsign: 'UAL111' }), filter, undefined)).toBe(true);
    expect(
      matchesFilter(makeAircraft({ callsign: 'UAL111', onGround: true }), filter, undefined),
    ).toBe(false);
  });
});

describe('filterAircraft', () => {
  const aircraft = [
    makeAircraft({ icaoHex: 'A00000', callsign: 'UAL111' }),
    makeAircraft({ icaoHex: 'B00000', callsign: 'DAL222', onGround: true }),
    makeAircraft({ icaoHex: 'C00000', callsign: 'UAL333' }),
  ];

  it('returns the input untouched with no filter', () => {
    expect(filterAircraft(aircraft, undefined, undefined)).toBe(aircraft);
  });

  it('keeps matching aircraft in their original order', () => {
    const kept = filterAircraft(aircraft, parse('ual'), undefined);
    expect(kept.map((candidate) => candidate.icaoHex)).toEqual(['A00000', 'C00000']);
  });
});
