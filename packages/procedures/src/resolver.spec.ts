import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createProcedureResolver } from './resolver.js';
import type { ProcedureResolver } from './resolver.js';

let resolver: ProcedureResolver;

before(async () => {
  const { usBundledProcedures } = await import('@squawk/procedure-data');
  resolver = createProcedureResolver({ data: usBundledProcedures.records });
});

describe('byName', () => {
  it('returns a matching STAR by computer code', () => {
    const result = resolver.byName('AALLE4');
    assert.ok(result, 'expected a result for AALLE4');
    assert.equal(result.computerCode, 'AALLE4');
    assert.equal(result.type, 'STAR');
    assert.equal(result.name, 'AALLE FOUR');
  });

  it('returns a matching SID by computer code', () => {
    const result = resolver.byName('ACCRA5');
    assert.ok(result, 'expected a result for ACCRA5');
    assert.equal(result.computerCode, 'ACCRA5');
    assert.equal(result.type, 'SID');
    assert.equal(result.name, 'ACCRA FIVE');
  });

  it('is case-insensitive', () => {
    const result = resolver.byName('aalle4');
    assert.ok(result, 'expected a result for aalle4 (lowercase)');
    assert.equal(result.computerCode, 'AALLE4');
  });

  it('returns undefined for unknown code', () => {
    assert.equal(resolver.byName('ZZZZZ9'), undefined);
  });
});

describe('byAirport', () => {
  it('returns procedures for a known airport', () => {
    const results = resolver.byAirport('DEN');
    assert.ok(results.length > 0, 'expected procedures for DEN');
    for (const proc of results) {
      assert.ok(proc.airports.includes('DEN'));
    }
  });

  it('includes both SIDs and STARs for a major airport', () => {
    const results = resolver.byAirport('DEN');
    const types = new Set(results.map((r) => r.type));
    assert.ok(types.size > 0, 'expected at least one procedure type for DEN');
  });

  it('is case-insensitive', () => {
    const upper = resolver.byAirport('DEN');
    const lower = resolver.byAirport('den');
    assert.equal(upper.length, lower.length);
  });

  it('returns empty array for unknown airport', () => {
    assert.deepEqual(resolver.byAirport('ZZZZZ'), []);
  });
});

describe('byType', () => {
  it('returns only SIDs when type is SID', () => {
    const results = resolver.byType('SID');
    assert.ok(results.length > 0);
    for (const proc of results) {
      assert.equal(proc.type, 'SID');
    }
  });

  it('returns only STARs when type is STAR', () => {
    const results = resolver.byType('STAR');
    assert.ok(results.length > 0);
    for (const proc of results) {
      assert.equal(proc.type, 'STAR');
    }
  });

  it('returns a reasonable count for each type', () => {
    const sids = resolver.byType('SID');
    const stars = resolver.byType('STAR');
    assert.ok(sids.length > 500, 'expected many SIDs');
    assert.ok(stars.length > 500, 'expected many STARs');
  });
});

describe('expand', () => {
  it('returns the first common route when no transition is specified', () => {
    const result = resolver.expand('AALLE4');
    assert.ok(result, 'expected expand result for AALLE4');
    assert.equal(result.procedure.computerCode, 'AALLE4');
    assert.ok(result.waypoints.length > 0);
    assert.equal(result.waypoints[0]!.fixIdentifier, 'AALLE');
  });

  it('returns transition + common route in arrival order when transition is specified for a STAR', () => {
    const result = resolver.expand('AALLE4', 'BBOTL');
    assert.ok(result, 'expected expand result for AALLE4 BBOTL transition');
    assert.ok(result.waypoints.length > 0);
    assert.equal(result.waypoints[0]!.fixIdentifier, 'BBOTL');

    const baseRoute = resolver.expand('AALLE4');
    assert.ok(baseRoute);
    const lastBase = baseRoute.waypoints[baseRoute.waypoints.length - 1]!.fixIdentifier;
    assert.equal(
      result.waypoints[result.waypoints.length - 1]!.fixIdentifier,
      lastBase,
      'expected STAR expansion to end at the common route terminus',
    );
  });

  it('returns common route + transition in departure order when transition is specified for a SID', () => {
    const result = resolver.expand('NUBLE4', 'JJIMY');
    assert.ok(result, 'expected expand result for NUBLE4 JJIMY transition');
    assert.ok(result.waypoints.length > 0);

    const baseRoute = resolver.expand('NUBLE4');
    assert.ok(baseRoute);
    assert.equal(
      result.waypoints[0]!.fixIdentifier,
      baseRoute.waypoints[0]!.fixIdentifier,
      'expected SID expansion to start at the common route origin',
    );
    assert.equal(
      result.waypoints[result.waypoints.length - 1]!.fixIdentifier,
      'JJIMY',
      'expected SID expansion to end at the transition terminus',
    );
  });

  it('deduplicates the connecting fix on a STAR transition+route merge', () => {
    const withTransition = resolver.expand('AALLE4', 'BBOTL');
    assert.ok(withTransition);

    const identifiers = withTransition.waypoints.map((wp) => wp.fixIdentifier);
    const aalleCount = identifiers.filter((id) => id === 'AALLE').length;
    assert.ok(aalleCount <= 1, 'expected AALLE to appear at most once after dedup');
  });

  it('deduplicates the connecting fix on a SID route+transition merge', () => {
    const withTransition = resolver.expand('NUBLE4', 'JJIMY');
    assert.ok(withTransition);

    const identifiers = withTransition.waypoints.map((wp) => wp.fixIdentifier);
    const nubleCount = identifiers.filter((id) => id === 'NUBLE').length;
    assert.equal(nubleCount, 1, 'expected NUBLE to appear exactly once after SID dedup');

    const nubleIndex = identifiers.indexOf('NUBLE');
    const rbelaIndex = identifiers.indexOf('RBELA');
    const jjimyIndex = identifiers.indexOf('JJIMY');
    assert.ok(
      nubleIndex < rbelaIndex && rbelaIndex < jjimyIndex,
      'expected NUBLE -> RBELA -> JJIMY ordering after the common route',
    );
  });

  it('is case-insensitive for computer code', () => {
    const result = resolver.expand('aalle4');
    assert.ok(result, 'expected case-insensitive expand to work');
  });

  it('is case-insensitive for transition name', () => {
    const result = resolver.expand('AALLE4', 'bbotl');
    assert.ok(result, 'expected case-insensitive transition to work');
  });

  it('returns undefined for unknown computer code', () => {
    assert.equal(resolver.expand('ZZZZZ9'), undefined);
  });

  it('returns undefined for unknown transition name', () => {
    assert.equal(resolver.expand('AALLE4', 'NONEXISTENT'), undefined);
  });

  it('works for a SID procedure', () => {
    const result = resolver.expand('ACCRA5');
    assert.ok(result, 'expected expand result for ACCRA5 SID');
    assert.equal(result.procedure.type, 'SID');
    assert.ok(result.waypoints.length > 0);
  });
});

describe('search', () => {
  it('finds procedures matching a substring in computer code', () => {
    const results = resolver.search({ text: 'AALLE' });
    assert.ok(results.length > 0);
    for (const proc of results) {
      const matchesCode = proc.computerCode.toUpperCase().includes('AALLE');
      const matchesName = proc.name.toUpperCase().includes('AALLE');
      assert.ok(matchesCode || matchesName);
    }
  });

  it('finds procedures matching a substring in name', () => {
    const results = resolver.search({ text: 'FOUR' });
    assert.ok(results.length > 0);
    for (const proc of results) {
      const matchesCode = proc.computerCode.toUpperCase().includes('FOUR');
      const matchesName = proc.name.toUpperCase().includes('FOUR');
      assert.ok(matchesCode || matchesName);
    }
  });

  it('returns results in alphabetical order by computer code', () => {
    const results = resolver.search({ text: 'A' });
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i - 1]!.computerCode.localeCompare(results[i]!.computerCode) <= 0,
        `expected ${results[i - 1]!.computerCode} <= ${results[i]!.computerCode}`,
      );
    }
  });

  it('respects the limit parameter', () => {
    const results = resolver.search({ text: 'A', limit: 5 });
    assert.ok(results.length <= 5);
  });

  it('filters by procedure type when provided', () => {
    const starResults = resolver.search({ text: 'A', type: 'STAR' });
    for (const proc of starResults) {
      assert.equal(proc.type, 'STAR');
    }

    const sidResults = resolver.search({ text: 'A', type: 'SID' });
    for (const proc of sidResults) {
      assert.equal(proc.type, 'SID');
    }
  });

  it('is case-insensitive', () => {
    const upper = resolver.search({ text: 'AALLE' });
    const lower = resolver.search({ text: 'aalle' });
    assert.equal(upper.length, lower.length);
  });

  it('returns empty array for empty text', () => {
    assert.deepEqual(resolver.search({ text: '' }), []);
  });
});
